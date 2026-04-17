import { env } from "../lib/config";
import { createRagIngestionService } from "../application/rag/ragIngestionService";
import { createDocumentExtractionAdapter } from "../providers/rag/documentExtractionAdapter";
import { createSupabaseRagRepositoryAdapter } from "../providers/rag/supabaseRagRepositoryAdapter";

async function main() {
  const service = createRagIngestionService({
    extractionAdapter: createDocumentExtractionAdapter(),
    repositoryAdapter: createSupabaseRagRepositoryAdapter()
  });
  const summary = await service.ingestBucket(env.SUPABASE_STORAGE_BUCKET);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
