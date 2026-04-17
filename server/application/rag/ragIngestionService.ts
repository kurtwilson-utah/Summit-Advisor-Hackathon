import type { DocumentExtractionAdapter } from "../../providers/rag/documentExtractionAdapter.js";
import type {
  RagSourceFile,
  SupabaseRagRepositoryAdapter
} from "../../providers/rag/supabaseRagRepositoryAdapter.js";

export interface RagIngestionSummary {
  bucket: string;
  discoveredFiles: number;
  ingestedDocuments: number;
  skippedFiles: Array<{ storagePath: string; reason: string }>;
}

export interface RagIngestionService {
  ingestBucket(bucket: string): Promise<RagIngestionSummary>;
}

export function createRagIngestionService(dependencies: {
  extractionAdapter: DocumentExtractionAdapter;
  repositoryAdapter: SupabaseRagRepositoryAdapter;
}): RagIngestionService {
  return {
    async ingestBucket(bucket) {
      const files = await dependencies.repositoryAdapter.listBucketFiles(bucket);
      const summary: RagIngestionSummary = {
        bucket,
        discoveredFiles: files.length,
        ingestedDocuments: 0,
        skippedFiles: []
      };

      for (const file of files) {
        const supported = isSupportedForCurrentPass(file);

        if (!supported) {
          summary.skippedFiles.push({
            storagePath: file.storagePath,
            reason: "Unsupported in the current ingestion pass."
          });
          continue;
        }

        try {
          const buffer = await dependencies.repositoryAdapter.downloadFile(bucket, file.storagePath);
          const extracted = await dependencies.extractionAdapter.extract({
            fileName: file.fileName,
            storagePath: file.storagePath,
            buffer
          });

          if (!extracted || extracted.text.length === 0) {
            summary.skippedFiles.push({
              storagePath: file.storagePath,
              reason: "No extractable text was produced."
            });
            continue;
          }

          const asset = await dependencies.repositoryAdapter.upsertKnowledgeAsset({
            bucket,
            sourceFile: file
          });
          const document = await dependencies.repositoryAdapter.upsertKnowledgeDocument({
            fileAssetId: asset.fileAssetId,
            sourceFile: file,
            extractedText: extracted.text,
            extractionMetadata: extracted.metadata
          });
          await dependencies.repositoryAdapter.replaceChunks({
            documentId: document.documentId,
            chunks: chunkDocument(file, extracted.text, extracted.metadata)
          });
          summary.ingestedDocuments += 1;
        } catch (error) {
          summary.skippedFiles.push({
            storagePath: file.storagePath,
            reason: error instanceof Error ? error.message : "Unexpected ingestion error."
          });
        }
      }

      return summary;
    }
  };
}

function isSupportedForCurrentPass(file: RagSourceFile): boolean {
  return file.fileName.toLowerCase().endsWith(".docx") || file.fileName.toLowerCase().endsWith(".csv");
}

function chunkDocument(
  file: RagSourceFile,
  text: string,
  extractionMetadata: Record<string, unknown>
): Array<{ content: string; metadata: Record<string, unknown>; tokenEstimate: number }> {
  const paragraphs =
    file.fileName.toLowerCase().endsWith(".csv")
      ? text.split("\n").filter(Boolean)
      : text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: Array<{ content: string; metadata: Record<string, unknown>; tokenEstimate: number }> = [];
  let currentChunk = "";
  let paragraphStartIndex = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length > 1400 && currentChunk) {
      chunks.push(createChunk(currentChunk, file, extractionMetadata, paragraphStartIndex, index - 1));
      currentChunk = paragraph;
      paragraphStartIndex = index;
      continue;
    }

    currentChunk = candidate;
  }

  if (currentChunk) {
    chunks.push(createChunk(currentChunk, file, extractionMetadata, paragraphStartIndex, paragraphs.length - 1));
  }

  return chunks;
}

function createChunk(
  content: string,
  file: RagSourceFile,
  extractionMetadata: Record<string, unknown>,
  startIndex: number,
  endIndex: number
) {
  return {
    content,
    tokenEstimate: Math.ceil(content.split(/\s+/).filter(Boolean).length * 1.33),
    metadata: {
      ...extractionMetadata,
      storagePath: file.storagePath,
      folderPath: file.folderPath,
      originalName: file.fileName,
      paragraphRange: [startIndex, endIndex]
    }
  };
}
