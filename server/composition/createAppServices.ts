import { createEmailAccessService } from "../application/access/emailAccessService.js";
import { createConversationFinalizationService } from "../application/finalization/conversationFinalizationService.js";
import { createIdeaExtractionService } from "../application/finalization/ideaExtractionService.js";
import { createOrchestrationService } from "../application/orchestration/orchestrationService.js";
import { createConversationPersistenceService } from "../application/persistence/conversationPersistenceService.js";
import { createKnowledgeRetrievalService } from "../application/rag/knowledgeRetrievalService.js";
import { createAccessSessionSigner } from "../lib/accessSessionSigner.js";
import { env } from "../lib/config.js";
import { createEnvAllowlistAdapter } from "../providers/access/envAllowlistAdapter.js";
import { createNotionProviderAdapter } from "../providers/integrations/notionProviderAdapter.js";
import { createClaudeProviderAdapter } from "../providers/model/claudeProviderAdapter.js";
import { createSupabasePersistenceAdapter } from "../providers/persistence/supabasePersistenceAdapter.js";
import { createSupabaseKnowledgeRetrievalAdapter } from "../providers/rag/supabaseKnowledgeRetrievalAdapter.js";

export function createAppServices() {
  const sessionSigner = createAccessSessionSigner();
  const claudeAdapter = createClaudeProviderAdapter();
  const persistenceService = createConversationPersistenceService({
    adapter: createSupabasePersistenceAdapter()
  });
  const knowledgeRetrievalService = createKnowledgeRetrievalService({
    adapter: createSupabaseKnowledgeRetrievalAdapter()
  });

  return {
    emailAccessService: createEmailAccessService({
      allowlistAdapter: createEnvAllowlistAdapter(env.ACCESS_ALLOWED_EMAILS.split(",")),
      sessionSigner
    }),
    persistenceService,
    orchestrationService: createOrchestrationService({
      claudeAdapter,
      persistenceService,
      knowledgeRetrievalService
    }),
    finalizationService: createConversationFinalizationService({
      ideaExtractionService: createIdeaExtractionService({
        claudeAdapter
      }),
      notionAdapter: createNotionProviderAdapter(),
      persistenceService
    })
  };
}
