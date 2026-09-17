import { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSION,
  RagChunkingService
} from './chunking.service';
import {
  DocumentChunkMetadata,
  DocumentChunkWithEmbedding,
  EmbeddingOptions
} from './types';

export class RagEmbeddingService {
  /**
   * Validates that an embedding vector strictly conforms to the expected 768-dimension contract.
   * Throws on null, undefined, wrong length, NaN, or non-finite numbers.
   */
  static validateVector(
    vector: any,
    expectedDimension: number = DEFAULT_EMBEDDING_DIMENSION
  ): number[] {
    if (!vector) {
      throw new Error('Vector validation failed: embedding is null or undefined');
    }

    if (!Array.isArray(vector)) {
      throw new Error(`Vector validation failed: expected Array, got ${typeof vector}`);
    }

    if (vector.length !== expectedDimension) {
      throw new Error(
        `Vector validation failed: dimension mismatch. Expected ${expectedDimension}, got ${vector.length}`
      );
    }

    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      if (typeof val !== 'number' || isNaN(val) || !Number.isFinite(val)) {
        throw new Error(
          `Vector validation failed: element at index ${i} is not a finite number (value: ${val})`
        );
      }
    }

    return vector as number[];
  }

  /**
   * Classifies whether an error is transient (retryable) or terminal (fatal).
   */
  static isRetryableError(err: any): boolean {
    if (!err) return false;

    const message = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode || err.code;

    // Terminal errors: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), invalid API key
    if (
      status === 400 ||
      status === 401 ||
      status === 403 ||
      message.includes('api_key_invalid') ||
      message.includes('api key not valid') ||
      message.includes('unauthorized') ||
      message.includes('permission_denied') ||
      message.includes('invalid argument')
    ) {
      return false;
    }

    // Transient errors: 429 (Rate Limit), 500, 502, 503, 504, network connection issues
    if (
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      status === 'RESOURCE_EXHAUSTED' ||
      status === 'UNAVAILABLE' ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('resource_exhausted') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed') ||
      message.includes('socket hang up') ||
      message.includes('timeout')
    ) {
      return true;
    }

    // Default to non-retryable for safety
    return false;
  }

  /**
   * Generates a single embedding for an arbitrary text string using Gemini with retries and timeout.
   * Strictly enforces: model = gemini-embedding-2, dimension = 768, NO taskType.
   */
  static async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    if (options.customEmbedder) {
      const customVec = await options.customEmbedder(text);
      return this.validateVector(customVec, options.dimension || DEFAULT_EMBEDDING_DIMENSION);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const model = options.model || DEFAULT_EMBEDDING_MODEL;
    const dimension = options.dimension || DEFAULT_EMBEDDING_DIMENSION;
    const maxRetries = options.maxRetries ?? 3; // 1 initial attempt + 2 retries
    const timeoutMs = options.timeoutMs ?? 15000;

    const ai = new GoogleGenAI({ apiKey });

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const embedPromise = ai.models.embedContent({
          model,
          contents: text,
          config: {
            outputDimensionality: dimension
            // CRITICAL: NO taskType parameter!
          }
        });

        // Bounded timeout race
        let timeoutHandle: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error(`Gemini embedding request timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        const response: any = await Promise.race([embedPromise, timeoutPromise]).finally(() => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
        });

        const values = response.embeddings?.[0]?.values;
        return this.validateVector(values, dimension);
      } catch (err: any) {
        lastError = err;

        if (!this.isRetryableError(err) || attempt === maxRetries) {
          throw new Error(
            `Gemini embedding call failed permanently on attempt ${attempt}/${maxRetries}: ${err.message || err}`
          );
        }

        // Exponential backoff with jitter: base 500ms, multiplier 2, jitter 0-250ms
        const baseDelay = 500 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelay + jitter;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Gemini embedding failed after maximum retries');
  }

  /**
   * Generates document embedding using the approved FORMATTED_V1 representation:
   * title: {title} | text: {chunkText}
   */
  static async generateDocumentEmbedding(
    title: string,
    chunkText: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const input = RagChunkingService.formatDocumentEmbeddingInput(title, chunkText);
    return this.generateEmbedding(input, options);
  }

  /**
   * Generates query embedding using the approved FORMATTED_V1 representation:
   * task: search result | query: {query}
   * (Isolated helper for testing / future evaluation; NOT called by production V1)
   */
  static async generateQueryEmbedding(
    query: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const input = RagChunkingService.formatQueryEmbeddingInput(query);
    return this.generateEmbedding(input, options);
  }

  /**
   * Embeds an array of document chunks with bounded concurrency (default <= 2)
   * and strict vector validation.
   * If any chunk fails to embed, this immediately aborts and throws.
   */
  static async batchEmbedChunks(
    chunks: DocumentChunkMetadata[],
    options: EmbeddingOptions = {}
  ): Promise<DocumentChunkWithEmbedding[]> {
    if (chunks.length === 0) return [];

    const concurrencyLimit = Math.min(options.concurrency || 2, 2); // Hard cap at 2
    const results: DocumentChunkWithEmbedding[] = new Array(chunks.length);

    let nextIndex = 0;
    let failureError: Error | null = null;

    // Concurrency worker loop
    const worker = async () => {
      while (nextIndex < chunks.length && !failureError) {
        const currentIndex = nextIndex++;
        const chunk = chunks[currentIndex];

        try {
          const vector = await this.generateEmbedding(chunk.embedding_input, options);
          results[currentIndex] = {
            ...chunk,
            embedding: vector
          };
        } catch (err: any) {
          failureError = err;
          break;
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, chunks.length) },
      () => worker()
    );

    await Promise.all(workers);

    if (failureError) {
      throw failureError;
    }

    return results;
  }
}
