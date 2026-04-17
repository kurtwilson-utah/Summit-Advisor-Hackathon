import { createSupabaseAdminClient } from "../../lib/supabaseAdmin";

interface RagDocumentRow {
  id: string;
  title: string;
  source_type: string;
  metadata: {
    sourceTier?: "preferred" | "fallback";
    sourcePriority?: number;
    isStubCandidate?: boolean;
    storagePath?: string;
  } | null;
}

interface RagChunkRow {
  document_id: string;
  chunk_index: number;
  content: string;
  token_estimate: number | null;
  metadata: {
    storagePath?: string;
  } | null;
}

export interface RetrievedChunkCandidate {
  documentId: string;
  title: string;
  sourceType: string;
  storagePath: string;
  content: string;
  tokenEstimate: number;
  sourceTier: "preferred" | "fallback";
  sourcePriority: number;
  isStubCandidate: boolean;
}

export interface KnowledgeRetrievalAdapter {
  loadReadyChunks(): Promise<RetrievedChunkCandidate[]>;
}

export function createSupabaseKnowledgeRetrievalAdapter(): KnowledgeRetrievalAdapter {
  const client = createSupabaseAdminClient();

  return {
    async loadReadyChunks() {
      const documentsResult = await client
        .from("rag_documents")
        .select("id, title, source_type, metadata")
        .eq("extraction_status", "ready");

      if (documentsResult.error) {
        throw documentsResult.error;
      }

      const documents = (documentsResult.data ?? []) as RagDocumentRow[];

      if (documents.length === 0) {
        return [];
      }

      const chunksResult = await client
        .from("rag_chunks")
        .select("document_id, chunk_index, content, token_estimate, metadata")
        .in(
          "document_id",
          documents.map((document) => document.id)
        )
        .order("document_id", { ascending: true })
        .order("chunk_index", { ascending: true });

      if (chunksResult.error) {
        throw chunksResult.error;
      }

      const documentsById = new Map(documents.map((document) => [document.id, document]));

      return ((chunksResult.data ?? []) as RagChunkRow[])
        .map((chunk) => {
          const document = documentsById.get(chunk.document_id);

          if (!document) {
            return null;
          }

          return {
            documentId: document.id,
            title: document.title,
            sourceType: document.source_type,
            storagePath:
              chunk.metadata?.storagePath ??
              document.metadata?.storagePath ??
              `${document.source_type}/${document.title}`,
            content: chunk.content,
            tokenEstimate: chunk.token_estimate ?? estimateTokens(chunk.content),
            sourceTier: document.metadata?.sourceTier === "fallback" ? "fallback" : "preferred",
            sourcePriority: document.metadata?.sourcePriority ?? 100,
            isStubCandidate: Boolean(document.metadata?.isStubCandidate)
          } satisfies RetrievedChunkCandidate;
        })
        .filter((candidate): candidate is RetrievedChunkCandidate => Boolean(candidate));
    }
  };
}

function estimateTokens(content: string) {
  return Math.ceil(content.split(/\s+/).filter(Boolean).length * 1.33);
}
