# Architecture Notes

## Runtime flow

1. User authenticates through an allowlisted email.
2. Backend issues a signed lightweight session token for the current temporary access mode.
3. User opens or resumes a chat thread.
4. Frontend syncs thread snapshots to the server-owned lightweight persistence tables.
5. Client redacts PII before the live model request is sent.
6. Frontend orchestration plans the visible thinking sequence:
   - considering the question
   - consulting Summit knowledge when needed
   - researching when needed
   - drafting the final answer
7. Server receives:
   - thread id
   - thread title
   - redacted user message
   - redaction map
   - recent thread messages
   - compressed memory digest
   - attachment metadata
8. Server loads:
   - active prompts
   - relevant RAG chunks
   - optional persisted thread context when available
9. Summit Product Manager decides whether to call the other two agents.
10. When Summit knowledge is needed, the server ranks retrieved chunks and asks the Knowledge Agent for an internal memo.
11. The Product Manager synthesizes the memo into the final user-facing answer returned as **Cyncly Advisor**.
12. On thread close, idle timeout, or page unload, the server saves the latest thread snapshot and finalizes exports to Notion.

## Layer boundaries

### Frontend

- `useChatWorkspace` owns UI state only.
- `chatWorkspaceRuntime` owns the turn lifecycle.
- orchestration service decides delegation and thinking steps.
- provider adapter produces the assistant response.
- persistence service owns local cache plus backend thread sync.
- finalization service owns export status transitions.

### Backend

- application services coordinate use cases.
- provider adapters isolate Supabase, Notion, and Claude integrations.
- the RAG retrieval service ranks lexical relevance today and can later swap to embeddings without changing orchestration contracts.
- lightweight runtime persistence is isolated from the future auth-owned tables so we can ship now without polluting the long-term ownership model.
- shared contracts in `shared/` keep both runtimes aligned on agent and orchestration types.

## Why thread compression matters

Each thread should maintain:

- recent visible turns
- a rolling hidden memory digest
- optional structured facts or decisions

That is the right place to minimize context-window usage without losing important continuity.
