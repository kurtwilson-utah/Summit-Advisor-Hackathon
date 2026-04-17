import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../../lib/supabaseAdmin";

interface StorageListItem {
  name: string;
  id?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
  } | null;
}

export interface RagSourceFile {
  fileName: string;
  storagePath: string;
  folderPath: string;
  byteSize: number;
  mimeType: string;
}

export interface PersistedKnowledgeDocument {
  documentId: string;
}

export interface SupabaseRagRepositoryAdapter {
  listBucketFiles(bucket: string): Promise<RagSourceFile[]>;
  downloadFile(bucket: string, storagePath: string): Promise<Buffer>;
  upsertKnowledgeAsset(args: {
    bucket: string;
    sourceFile: RagSourceFile;
  }): Promise<{ fileAssetId: string }>;
  upsertKnowledgeDocument(args: {
    fileAssetId: string;
    sourceFile: RagSourceFile;
    extractedText: string;
    extractionMetadata: Record<string, unknown>;
  }): Promise<PersistedKnowledgeDocument>;
  replaceChunks(args: {
    documentId: string;
    chunks: Array<{ content: string; metadata: Record<string, unknown>; tokenEstimate: number }>;
  }): Promise<void>;
}

export function createSupabaseRagRepositoryAdapter(): SupabaseRagRepositoryAdapter {
  const client = createSupabaseAdminClient();

  return {
    async listBucketFiles(bucket) {
      return listFilesRecursive(client, bucket, "");
    },
    async downloadFile(bucket, storagePath) {
      const { data, error } = await client.storage.from(bucket).download(storagePath);

      if (error || !data) {
        throw new Error(`Unable to download ${storagePath}: ${error?.message ?? "unknown error"}`);
      }

      return Buffer.from(await data.arrayBuffer());
    },
    async upsertKnowledgeAsset({ bucket, sourceFile }) {
      const existing = await client
        .from("file_assets")
        .select("id")
        .eq("storage_bucket", bucket)
        .eq("storage_path", sourceFile.storagePath)
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data?.id) {
        const updateResult = await client
          .from("file_assets")
          .update({
            mime_type: sourceFile.mimeType,
            original_name: sourceFile.fileName,
            size_bytes: sourceFile.byteSize,
            kind: "rag-source"
          })
          .eq("id", existing.data.id);

        if (updateResult.error) {
          throw updateResult.error;
        }

        return { fileAssetId: existing.data.id };
      }

      const insertResult = await client
        .from("file_assets")
        .insert({
          owner_id: null,
          storage_bucket: bucket,
          storage_path: sourceFile.storagePath,
          mime_type: sourceFile.mimeType,
          original_name: sourceFile.fileName,
          kind: "rag-source",
          size_bytes: sourceFile.byteSize
        })
        .select("id")
        .single();

      if (insertResult.error || !insertResult.data) {
        const message = insertResult.error?.message ?? `Unable to insert file asset for ${sourceFile.storagePath}`;

        if (/null value in column "owner_id"/i.test(message)) {
          throw new Error(
            'The RAG shared-assets migration has not been run yet. Run: alter table public.file_assets alter column owner_id drop not null;'
          );
        }

        throw insertResult.error ?? new Error(message);
      }

      return { fileAssetId: insertResult.data.id };
    },
    async upsertKnowledgeDocument({ fileAssetId, sourceFile, extractedText, extractionMetadata }) {
      const title = sourceFile.fileName.replace(/\.[^.]+$/, "");
      const existing = await client
        .from("rag_documents")
        .select("id")
        .eq("file_asset_id", fileAssetId)
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data?.id) {
        const updateResult = await client
          .from("rag_documents")
          .update({
            title,
            source_type: sourceFile.folderPath || "root",
            extraction_status: "ready",
            extracted_text: extractedText,
            metadata: {
              ...extractionMetadata,
              storagePath: sourceFile.storagePath,
              folderPath: sourceFile.folderPath
            }
          })
          .eq("id", existing.data.id);

        if (updateResult.error) {
          throw updateResult.error;
        }

        return { documentId: existing.data.id };
      }

      const insertResult = await client
        .from("rag_documents")
        .insert({
          file_asset_id: fileAssetId,
          title,
          source_type: sourceFile.folderPath || "root",
          extraction_status: "ready",
          extracted_text: extractedText,
          metadata: {
            ...extractionMetadata,
            storagePath: sourceFile.storagePath,
            folderPath: sourceFile.folderPath
          }
        })
        .select("id")
        .single();

      if (insertResult.error || !insertResult.data) {
        throw insertResult.error ?? new Error(`Unable to insert rag document for ${sourceFile.storagePath}`);
      }

      return { documentId: insertResult.data.id };
    },
    async replaceChunks({ documentId, chunks }) {
      const deleteResult = await client.from("rag_chunks").delete().eq("document_id", documentId);

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      if (chunks.length === 0) {
        return;
      }

      for (let index = 0; index < chunks.length; index += 50) {
        const batch = chunks.slice(index, index + 50).map((chunk, batchIndex) => ({
          document_id: documentId,
          chunk_index: index + batchIndex,
          content: chunk.content,
          token_estimate: chunk.tokenEstimate,
          metadata: chunk.metadata
        }));
        const insertResult = await client.from("rag_chunks").insert(batch);

        if (insertResult.error) {
          throw insertResult.error;
        }
      }
    }
  };
}

async function listFilesRecursive(
  client: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<RagSourceFile[]> {
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) {
    throw new Error(`Unable to list ${prefix || bucket}: ${error.message}`);
  }

  const files: RagSourceFile[] = [];

  for (const item of (data as StorageListItem[]) ?? []) {
    if (item.name === ".emptyFolderPlaceholder") {
      continue;
    }

    const nextPath = prefix ? `${prefix}/${item.name}` : item.name;
    const isFolder = !item.id;

    if (isFolder) {
      files.push(...(await listFilesRecursive(client, bucket, nextPath)));
      continue;
    }

    files.push({
      fileName: item.name,
      storagePath: normalizeStoragePath(nextPath),
      folderPath: prefix,
      byteSize: item.metadata?.size ?? 0,
      mimeType: item.metadata?.mimetype ?? inferMimeType(item.name)
    });
  }

  return files;
}

function inferMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (lowerName.endsWith(".csv")) {
    return "text/csv";
  }

  return "application/octet-stream";
}

function normalizeStoragePath(storagePath: string): string {
  return storagePath.replace(/^\/+/, "");
}
