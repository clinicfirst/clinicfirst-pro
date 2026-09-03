import http from 'http';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function request(
  method: string,
  path: string,
  data: any = null,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const dataStr = data ? JSON.stringify(data) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(dataStr) : 0,
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(body || '{}'), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 0, data: body, headers: res.headers });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(dataStr);
    req.end();
  });
}

function scanDirForPatterns(dir: string, patterns: string[]): string[] {
  const violations: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      violations.push(...scanDirForPatterns(fullPath, patterns));
    } else if (stat.isFile() && /\.(tsx?|jsx?|html|json)$/.test(entry)) {
      const content = readFileSync(fullPath, 'utf8');
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          violations.push(`${fullPath} contains forbidden pattern: ${pattern}`);
        }
      }
    }
  }

  return violations;
}

async function runE2E() {
  console.log('----------------------------------------------------');
  console.log('PHASE 16.4 COMPREHENSIVE E2E VERIFICATION');
  console.log('----------------------------------------------------\n');

  // TEST E: Unauthenticated request to /api/ai/sarvam/test
  console.log('TEST E: Unauthenticated request to /api/ai/sarvam/test');
  const unauth = await request('GET', '/api/ai/sarvam/test');
  console.log('  Status:', unauth.status, '(Expected: 401)');
  console.log('  Payload:', unauth.data);
  if (unauth.status !== 401) throw new Error('TEST E Failed');
  console.log('  -> TEST E: PASS\n');

  // Login as non-platform admin (Clinic Admin)
  console.log('TEST F: Non-Platform-Admin RBAC validation');
  const clinicLogin = await request('POST', '/api/auth/login', {
    email: 'admin@apexclinic.com',
    password: 'ApexClinic2026!',
  });
  const clinicToken = clinicLogin.data.token;
  const nonAdmin = await request('GET', '/api/ai/sarvam/test', null, {
    Authorization: `Bearer ${clinicToken}`,
  });
  console.log('  Status:', nonAdmin.status, '(Expected: 403)');
  console.log('  Payload:', nonAdmin.data);
  if (nonAdmin.status !== 403) throw new Error('TEST F Failed');
  console.log('  -> TEST F: PASS\n');

  // Login as Platform Admin
  console.log('TEST A & B: Authenticated Platform Admin request to /api/ai/sarvam/test');
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@clinicfirst.internal',
    password: 'AdminPassword123!',
  });
  const adminToken = adminLogin.data.token;
  const adminTest = await request('GET', '/api/ai/sarvam/test', null, {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log('  Diagnostic Response:', JSON.stringify(adminTest.data, null, 2));

  // Check no secret leakage in response
  const serialized = JSON.stringify(adminTest.data);
  const hasSecretLeak = process.env.SARVAM_API_KEY ? serialized.includes(process.env.SARVAM_API_KEY) : false;
  if (hasSecretLeak || serialized.includes('api-subscription-key')) {
    throw new Error('Secret leaked in response!');
  }
  console.log('  -> No Secret Leakage: PASS\n');

  // TEST G: Frontend source scan
  console.log('TEST G: Frontend source scan (src/)');
  const srcViolations = scanDirForPatterns(join(process.cwd(), 'src'), [
    'SARVAM_API_KEY',
    'VITE_SARVAM_API_KEY',
    'NEXT_PUBLIC_SARVAM_API_KEY',
  ]);
  if (srcViolations.length > 0) throw new Error(`TEST G Failed: ${srcViolations.join(', ')}`);
  console.log('  -> TEST G: PASS (0 forbidden patterns in src/)\n');

  // TEST H: Production build scan
  console.log('TEST H: Production build scan (dist/)');
  const distViolations = [];
  if (process.env.SARVAM_API_KEY) {
    distViolations.push(...scanDirForPatterns(join(process.cwd(), 'dist'), [process.env.SARVAM_API_KEY]));
  }
  if (distViolations.length > 0) throw new Error(`TEST H Failed: ${distViolations.join(', ')}`);
  console.log('  -> TEST H: PASS (0 secret leaks in dist/)\n');

  console.log('ALL PHASE 16.4 AUTOMATED GATES TESTED SUCCESSFULLY.');
}

runE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
