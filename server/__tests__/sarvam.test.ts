/**
 * Phase 16.4 Verification Tests: Server-side Sarvam API Connectivity & Diagnostics
 */

import { sarvamClient, SarvamClient } from '../integrations/sarvam/SarvamClient';
import { isSarvamApiConfigured, getSarvamApiKey } from '../config/sarvam';
import dotenv from 'dotenv';
dotenv.config();
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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

export async function runAllSarvamGateTests() {
  console.log('\n======================================================');
  console.log('RUNNING PHASE 16.4 SARVAM API CONNECTIVITY & SECURITY TESTS');
  console.log('======================================================\n');

  // TEST G: Frontend Source Scan
  console.log('TEST G: Frontend Source Scan (src/)');
  const forbiddenFrontend = [
    'SARVAM_API_KEY',
    'VITE_SARVAM_API_KEY',
    'NEXT_PUBLIC_SARVAM_API_KEY',
    'PUBLIC_SARVAM_API_KEY',
  ];
  const srcViolations = scanDirForPatterns(join(process.cwd(), 'src'), forbiddenFrontend);
  if (srcViolations.length > 0) {
    console.error('TEST G FAIL: Forbidden patterns found in src/:', srcViolations);
    throw new Error('TEST G FAILED');
  }
  console.log('  -> PASS: Zero references to SARVAM_API_KEY or public variations in src/\n');

  // TEST C1: Missing Key Handling
  console.log('TEST C1: Missing SARVAM_API_KEY handling');
  const missingResult = await sarvamClient.testConnectivity('');
  console.log('  Result:', missingResult);
  if (
    missingResult.success !== false ||
    missingResult.provider !== 'sarvam' ||
    !missingResult.error?.includes('not configured')
  ) {
    console.error('TEST C1 FAIL: Missing key did not fail safely', missingResult);
    throw new Error('TEST C1 FAILED');
  }
  console.log('  -> PASS: Missing key failed safely with clean error\n');

  // TEST C2: Invalid Key Handling (Real HTTPS request to Sarvam with rejected credentials)
  console.log('TEST C2: Invalid SARVAM_API_KEY handling');
  const invalidKey = 'invalid_test_key_sample_123';
  const invalidResult = await sarvamClient.testConnectivity(invalidKey);
  console.log('  Result:', invalidResult);
  if (
    invalidResult.success !== false ||
    invalidResult.provider !== 'sarvam' ||
    !invalidResult.error?.includes('authentication failed')
  ) {
    console.error('TEST C2 FAIL: Invalid key did not fail safely', invalidResult);
    throw new Error('TEST C2 FAILED');
  }
  // Check no secret leakage
  const serialized = JSON.stringify(invalidResult);
  if (serialized.includes(invalidKey)) {
    console.error('TEST C2 FAIL: Secret leaked in error response!');
    throw new Error('TEST C2 FAILED: Secret leaked');
  }
  console.log('  -> PASS: Invalid key failed safely with 401/403 sanitized, no secret leaked\n');

  // TEST A & B: Configured Key Request
  console.log('TEST A & B: Configured SARVAM_API_KEY Live Connectivity Check');
  const isConfigured = isSarvamApiConfigured();
  console.log(`  SARVAM_API_KEY configured in environment: ${isConfigured}`);

  const liveResult = await sarvamClient.testConnectivity();
  console.log('  Live Connectivity Result:', liveResult);

  // Validate that response contains no secrets
  const liveSerialized = JSON.stringify(liveResult);
  const currentKey = getSarvamApiKey() || '';
  if (currentKey && liveSerialized.includes(currentKey)) {
    console.error('FAIL: Current SARVAM_API_KEY leaked in live response!');
    throw new Error('Secret leaked in live response');
  }

  console.log('\n======================================================');
  console.log('PHASE 16.4 TEST SUITE COMPLETED');
  console.log('======================================================\n');
  return {
    testG: 'PASS',
    testC: 'PASS',
    liveResult,
  };
}

if (process.argv[1]?.includes('sarvam.test')) {
  runAllSarvamGateTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
