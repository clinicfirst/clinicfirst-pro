import { GoogleGenAI } from '@google/genai';
import { supabase, isOfflineMode } from '../supabaseDiff';

// Make embedding configurable as requested
const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'gemini-embedding-2';
const RAG_EMBEDDING_DIMENSION = parseInt(process.env.RAG_EMBEDDING_DIMENSION || '768', 10);

export class RagService {
  /**
   * Deterministic Markdown chunking.
   * Splits by Heading 2 (##) and Heading 3 (###) to keep sections semantic.
   */
  static chunkMarkdown(markdown: string): string[] {
    if (!markdown) return [];
    
    // Split on ## or ### keeping the delimiter
    const splitRegex = /(?=^#{2,3} )/m;
    const rawChunks = markdown.split(splitRegex);
    
    const processedChunks: string[] = [];
    let currentChunk = "";
    
    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      
      // If a chunk is too long, we might need further splitting, 
      // but for clinic knowledge, sections are usually well-sized.
      if (currentChunk.length + trimmed.length > 2000) {
        if (currentChunk) {
          processedChunks.push(currentChunk.trim());
          currentChunk = "";
        }
      }
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
    
    if (currentChunk) {
      processedChunks.push(currentChunk.trim());
    }
    
    return processedChunks;
  }

  /**
   * Generate embedding using Gemini
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      const response = await ai.models.embedContent({
        model: RAG_EMBEDDING_MODEL,
        contents: text,
        config: {
          outputDimensionality: RAG_EMBEDDING_DIMENSION
        }
      });
      return response.embeddings?.[0]?.values || [];
    } catch (err: any) {
      console.error('[RagService.generateEmbedding] Error:', err);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Index a knowledge release into pgvector chunks
   */
  static async indexRelease(clinicId: string, releaseId: string, compiledContent: string): Promise<void> {
    if (isOfflineMode || !supabase) {
      console.log('[RagService.indexRelease] Skipping pgvector indexing in offline mode.');
      return;
    }

    try {
      const chunks = this.chunkMarkdown(compiledContent);
      if (chunks.length === 0) return;

      console.log(`[RagService.indexRelease] Chunked release ${releaseId} into ${chunks.length} chunks.`);

      // Generate embeddings sequentially to avoid rate limits (or use Promise.all with concurrency limit)
      const recordsToInsert = [];
      for (let i = 0; i < chunks.length; i++) {
        const text = chunks[i];
        const embedding = await this.generateEmbedding(text);
        if (embedding.length !== RAG_EMBEDDING_DIMENSION) {
          throw new Error(`Embedding dimension mismatch: expected ${RAG_EMBEDDING_DIMENSION}, got ${embedding.length}`);
        }
        
        recordsToInsert.push({
          clinic_id: clinicId,
          release_id: releaseId,
          chunk_index: i,
          chunk_text: text,
          embedding: embedding
        });
      }

      // Insert new chunks FIRST
      const { error } = await supabase
        .from('clinic_knowledge_chunks')
        .insert(recordsToInsert);

      if (error) {
        throw error;
      }

      // Then cleanly delete older releases
      await supabase
        .from('clinic_knowledge_chunks')
        .delete()
        .eq('clinic_id', clinicId)
        .neq('release_id', releaseId);
      
      console.log(`[RagService.indexRelease] Successfully indexed ${chunks.length} chunks for clinic ${clinicId}.`);
    } catch (err) {
      console.error('[RagService.indexRelease] Failed to index release:', err);
      throw err;
    }
  }

  /**
   * Search knowledge base using query
   */
  static async searchKnowledge(clinicId: string, query: string, matchCount: number = 3, matchThreshold: number = 0.6): Promise<string[]> {
    if (isOfflineMode || !supabase) {
      console.log('[RagService.searchKnowledge] Offline mode fallback.');
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_clinic_knowledge', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_clinic_id: clinicId
      });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: any) => row.chunk_text);
    } catch (err) {
      console.error('[RagService.searchKnowledge] Failed to search:', err);
      return ["(Error retrieving knowledge context.)"];
    }
  }
}
