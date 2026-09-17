import crypto from 'crypto';
import { DocumentChunkMetadata } from './types';

export const REPRESENTATION_VERSION_FORMATTED_V1 = 'FORMATTED_V1';
export const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2';
export const DEFAULT_EMBEDDING_DIMENSION = 768;

export class RagChunkingService {
  /**
   * Deterministic Markdown chunking matching production RagService.chunkMarkdown.
   * Splits on Heading 2 (##) and Heading 3 (###) to keep sections semantic.
   */
  static splitMarkdownSections(markdown: string): string[] {
    if (!markdown) return [];

    const splitRegex = /(?=^#{2,3} )/m;
    const rawChunks = markdown.split(splitRegex);

    const processedChunks: string[] = [];

    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      // Skip standalone top-level H1 document title if it has no body content
      if (/^#\s+[^#\n]+$/.test(trimmed)) {
        continue;
      }

      // If a single semantic section exceeds 2000 characters, break it down further by paragraphs
      if (trimmed.length > 2000) {
        const paragraphs = trimmed.split(/\n\s*\n/);
        let current = "";
        for (const p of paragraphs) {
          if (current && (current.length + p.length > 2000)) {
            processedChunks.push(current.trim());
            current = "";
          }
          current += (current ? "\n\n" : "") + p.trim();
        }
        if (current) {
          processedChunks.push(current.trim());
        }
      } else {
        processedChunks.push(trimmed);
      }
    }

    return processedChunks;
  }

  /**
   * Extracts section title and body text from a raw markdown section chunk.
   */
  static extractTitleAndText(rawChunk: string): { title: string; text: string } {
    const trimmed = rawChunk.trim();
    const headingMatch = trimmed.match(/^#{1,4}\s+(.+?)(?:\r?\n|$)/);

    let title = 'General Overview';
    let text = trimmed;

    if (headingMatch && headingMatch[1]) {
      title = headingMatch[1].trim();
      // Remove the heading line to extract the body
      const rest = trimmed.slice(headingMatch[0].length).trim();
      text = rest || title;
    }

    return { title, text };
  }

  /**
   * Builds the formatted document representation for FORMATTED_V1:
   * title: {section_title} | text: {chunk_text}
   */
  static formatDocumentEmbeddingInput(title: string, text: string): string {
    return `title: ${title} | text: ${text}`;
  }

  /**
   * Builds the formatted query representation for FORMATTED_V1 (isolated helper):
   * task: search result | query: {query}
   */
  static formatQueryEmbeddingInput(query: string): string {
    return `task: search result | query: ${query.trim()}`;
  }

  /**
   * Deterministic chunk-level content hash:
   * SHA-256 of:
   * representation_version + '\n' +
   * embedding_model + '\n' +
   * embedding_dimension + '\n' +
   * title + '\n' +
   * chunk_text + '\n' +
   * embedding_input
   */
  static computeChunkContentHash(
    representationVersion: string,
    embeddingModel: string,
    embeddingDimension: number,
    title: string,
    text: string,
    embeddingInput: string
  ): string {
    const payload = [
      representationVersion,
      embeddingModel,
      embeddingDimension.toString(),
      title,
      text,
      embeddingInput
    ].join('\n');

    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Deterministic index-level content hash:
   * SHA-256 of:
   * compiledContent + '\n' +
   * representation_version + '\n' +
   * embedding_model + '\n' +
   * embedding_dimension
   */
  static computeIndexContentHash(
    compiledContent: string,
    representationVersion: string = REPRESENTATION_VERSION_FORMATTED_V1,
    embeddingModel: string = DEFAULT_EMBEDDING_MODEL,
    embeddingDimension: number = DEFAULT_EMBEDDING_DIMENSION
  ): string {
    const payload = [
      compiledContent,
      representationVersion,
      embeddingModel,
      embeddingDimension.toString()
    ].join('\n');

    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Deterministically chunk a published release's compiled content
   * into structured chunk metadata ready for embedding.
   */
  static chunkReleaseContent(
    compiledContent: string,
    representationVersion: string = REPRESENTATION_VERSION_FORMATTED_V1,
    embeddingModel: string = DEFAULT_EMBEDDING_MODEL,
    embeddingDimension: number = DEFAULT_EMBEDDING_DIMENSION
  ): DocumentChunkMetadata[] {
    const rawChunks = this.splitMarkdownSections(compiledContent);

    return rawChunks.map((raw, index) => {
      const { title, text } = this.extractTitleAndText(raw);
      const embeddingInput = this.formatDocumentEmbeddingInput(title, text);
      const chunkHash = this.computeChunkContentHash(
        representationVersion,
        embeddingModel,
        embeddingDimension,
        title,
        text,
        embeddingInput
      );

      return {
        chunk_index: index,
        chunk_title: title,
        chunk_text: text,
        embedding_input: embeddingInput,
        chunk_content_hash: chunkHash
      };
    });
  }
}
