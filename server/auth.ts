import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { UserService } from './services/user.service';
import { User, PermissionAction } from '../src/types';
import { can } from '../src/lib/permissions';

const JWT_SECRET = process.env.JWT_SECRET || 'clinicfirst_super_secure_tenant_secret_2026';

export interface AuthenticatedRequest extends Request {
  user?: User;
  clinicId?: string;
}

export function generateToken(user: User): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinic_id: user.clinic_id,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): { sub: string; role: string; clinic_id: string | null } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  
  let user = null;
  try { user = await UserService.getById(payload.sub); } catch(e) { return res.status(500).json({error: 'Database error validating session'}); }
  if (!user || user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'User account is inactive or not found.' });
  }

  const { password_hash, ...cleanUser } = user;
  req.user = cleanUser;
  req.clinicId = cleanUser.clinic_id || undefined;
  next();
}

export function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ error: 'Platform Administrator privileges required.' });
  }
  next();
}

export function requireClinicPermission(action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!can(req.user, action)) {
      return res.status(403).json({ error: `Permission denied for action: ${action}` });
    }

    if (req.user.role !== 'PLATFORM_ADMIN' && !req.user.clinic_id) {
      return res.status(403).json({ error: 'User is not assigned to a clinic.' });
    }

    // Strict Tenant Isolation check:
    // If client passes clinic_id in params or body that doesn't match session clinic_id, reject!
    if (req.user.role !== 'PLATFORM_ADMIN') {
      const clientClinicId = req.params.clinic_id || req.body?.clinic_id || req.query?.clinic_id;
      if (clientClinicId && clientClinicId !== req.user.clinic_id) {
        return res.status(403).json({
          error: 'Tenant isolation violation: Cross-clinic access is strictly forbidden.',
        });
      }
    }

    next();
  };
}
