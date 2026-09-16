import { RagService } from '../../services/rag.service';

export async function searchClinicKnowledge(clinicId: string, params: { query: string }) {
  const { query } = params;

  if (!query) {
    return {
      success: false,
      error_code: "MISSING_QUERY",
      message: "A search query is required."
    };
  }

  try {
    const matchingChunks = await RagService.searchKnowledge(clinicId, query);
    
    if (matchingChunks.length === 0) {
      return {
        success: true,
        found: false,
        message: "No specific knowledge base information found matching this query. Standard clinic policies apply.",
        context: ""
      };
    }

    return {
      success: true,
      found: true,
      message: `Found ${matchingChunks.length} relevant sections in the clinic knowledge base.`,
      context: matchingChunks.join('\n\n---\n\n')
    };
  } catch (error: any) {
    console.error('[searchClinicKnowledge] Error:', error);
    return {
      success: false,
      error_code: "SEARCH_FAILED",
      message: "Failed to search the knowledge base."
    };
  }
}
