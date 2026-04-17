import { env } from "../lib/config.js";
import { createRagIngestionService } from "../application/rag/ragIngestionService.js";
import { createDocumentExtractionAdapter } from "../providers/rag/documentExtractionAdapter.js";
import { createSupabaseRagRepositoryAdapter } from "../providers/rag/supabaseRagRepositoryAdapter.js";

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
