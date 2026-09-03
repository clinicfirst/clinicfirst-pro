/**
 * Server-side Sarvam API Client.
 *
 * All requests to Sarvam AI MUST originate from the server.
 * The SARVAM_API_KEY secret is NEVER exposed to the frontend, logs, or error responses.
 */

import { getSarvamApiKey, isSarvamApiConfigured } from '../../config/sarvam';

export interface SarvamDiagnosticResult {
  success: boolean;
  provider: 'sarvam';
  message?: string;
  error?: string;
}

export class SarvamClient {
  private readonly baseUrl: string = 'https://api.sarvam.ai';
  private readonly defaultTimeoutMs: number = 10000;

  /**
   * Executes a minimal, deterministic connectivity test against Sarvam AI.
   *
   * @param overrideApiKey Optional key for isolated testing of missing/invalid credentials.
   * @returns Sanitized diagnostic result without secret leakage.
   */
  public async testConnectivity(overrideApiKey?: string): Promise<SarvamDiagnosticResult> {
    const apiKey = overrideApiKey !== undefined ? overrideApiKey : getSarvamApiKey();

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        provider: 'sarvam',
        error: 'SARVAM_API_KEY is not configured on the server.',
      };
    }

    const endpoint = `${this.baseUrl}/v1/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey.trim(),
        },
        body: JSON.stringify({
          model: 'sarvam-105b',
          messages: [
            {
              role: 'user',
              content: 'Respond with exactly: Clinic-1st Sarvam connectivity OK',
            },
          ],
          max_tokens: 50,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          provider: 'sarvam',
          error: 'Sarvam API authentication failed (invalid or unauthorized API key).',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          provider: 'sarvam',
          error: `Sarvam API request failed (HTTP ${response.status}).`,
        };
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        return {
          success: false,
          provider: 'sarvam',
          error: 'Malformed or unexpected response format from Sarvam API.',
        };
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        return {
          success: false,
          provider: 'sarvam',
          error: 'Malformed or unexpected response format from Sarvam API.',
        };
      }

      return {
        success: true,
        provider: 'sarvam',
        message: content.trim(),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message?.includes('aborted')) {
        return {
          success: false,
          provider: 'sarvam',
          error: 'Sarvam API request timed out.',
        };
      }

      return {
        success: false,
        provider: 'sarvam',
        error: 'Network error connecting to Sarvam API.',
      };
    }
  }
}

export const sarvamClient = new SarvamClient();
