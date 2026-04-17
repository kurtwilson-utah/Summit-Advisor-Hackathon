import { createEmailAccessService } from "../application/access/emailAccessService";
import { createConversationFinalizationService } from "../application/finalization/conversationFinalizationService";
import { createIdeaExtractionService } from "../application/finalization/ideaExtractionService";
import { createOrchestrationService } from "../application/orchestration/orchestrationService";
import { createConversationPersistenceService } from "../application/persistence/conversationPersistenceService";
import { createKnowledgeRetrievalService } from "../application/rag/knowledgeRetrievalService";
import { createAccessSessionSigner } from "../lib/accessSessionSigner";
import { env } from "../lib/config";
import { createEnvAllowlistAdapter } from "../providers/access/envAllowlistAdapter";
import { createNotionProviderAdapter } from "../providers/integrations/notionProviderAdapter";
import { createClaudeProviderAdapter } from "../providers/model/claudeProviderAdapter";
import { createSupabasePersistenceAdapter } from "../providers/persistence/supabasePersistenceAdapter";
import { createSupabaseKnowledgeRetrievalAdapter } from "../providers/rag/supabaseKnowledgeRetrievalAdapter";

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
