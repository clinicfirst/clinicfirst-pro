/**
 * Server-side configuration for Sarvam API integration.
 * NEVER expose these functions to the frontend.
 */

export function getSarvamApiKey(): string | undefined {
  return process.env.SARVAM_API_KEY;
}

export function isSarvamApiConfigured(): boolean {
  const key = getSarvamApiKey();
  return typeof key === 'string' && key.trim().length > 0;
}
