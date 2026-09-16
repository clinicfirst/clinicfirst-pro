# ClinicFirst AI — Phase 1C: RAG v1 Implementation Assessment

## 1. Existing Architecture Relevant to RAG
- **Knowledge Pipeline:** `knowledgeCompiler.routes.ts` handles compilation and publishing. `KnowledgeService` interacts with Supabase for `clinic_knowledge_releases`.
- **Database:** PostgreSQL via Supabase (`supabaseDiff.ts`), with an explicit offline fallback (`db.ts`).
- **AI Tooling:** `server/voice/tools/index.ts` and `voice.routes.ts` manage live execution of tools for Sarvam and Gemini Live.
- **SDKs:** `@google/genai` is available for embeddings.

## 2. Existing Components We Can Reuse
- **Supabase Client:** Ready to execute RPC calls.
- **`@google/genai`:** Will be used for `text-embedding-004` (768 dims).
- **Knowledge Release Workflow:** We will hook into the `publish` endpoint in `knowledgeCompiler.routes.ts`.

## 3. Existing Components That Must Remain Untouched
- **Authoritative Business Tools:** Appointment, patient, and schedule tracking tools will remain exactly as they are.
- **`voice-engine.ts` System Prompts:** We will preserve the existing system instruction hierarchy.
- **Tenant Authorization & Security:** Existing middleware and tenant scoping (`clinic_id`) must remain standard across all new operations.

## 4. Potential Conflicts
- **Offline Mode Compatibility:** Local offline development (`OFFLINE_MODE=true`) does not support `pgvector` or Supabase RPCs natively. **Resolution:** The embedding generation and retrieval will gracefully fallback or skip when `isOfflineMode` is true.

## 5. Required Migrations
- A new migration `20260915000000_rag_v1_knowledge.sql` to:
  1. Enable `pgvector`.
  2. Create `clinic_knowledge_chunks` (clinic_id, release_id, chunk_text, embedding vector(768)).
  3. Create an RPC function `match_clinic_knowledge` for tenant-filtered cosine similarity search.

## 6. Required New Services
- `RagService` (`server/services/rag.service.ts`):
  - `generateEmbeddings(text)`: Calls Gemini API.
  - `chunkMarkdown(content)`: Deterministic chunking by markdown headers.
  - `indexRelease(clinicId, releaseId, content)`: Chunks, embeds, and inserts to PG.
  - `searchKnowledge(clinicId, query)`: Embeds query, calls RPC.
- A new voice tool: `server/voice/tools/search-knowledge.ts`.
- Update `server/voice/tools/index.ts` to include `searchClinicKnowledge`.
- Update `server/routes/voice.routes.ts` to support the new tool webhook for Sarvam.

## 7. Required Tests / Verifications
- Verify chunking correctly segments markdown.
- Verify RPC correctly scopes search to `clinic_id`.
