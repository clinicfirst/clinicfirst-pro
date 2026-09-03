const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'clinicfirst_super_secure_tenant_secret_2026';

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

const token = generateToken({
  sub: 'usr_1787923240250_irur',
  email: 'admin@clinic.com',
  role: 'CLINIC_ADMIN',
  clinic_id: 'clinic_1787923240249_cqgw',
  name: 'Dr. Ujwala Maske',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
});

console.log(token);
