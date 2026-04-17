import type { ChatThread, EmailAccessSession } from "../../../shared/thread";
import type { IdeaExtractionService } from "./ideaExtractionService";
import type { NotionProviderAdapter } from "../../providers/integrations/notionProviderAdapter";
import type { ConversationPersistenceService } from "../persistence/conversationPersistenceService";

export interface ConversationFinalizationService {
  finalizeConversation(args: {
    threadId: string;
    closeReason: string;
    session?: EmailAccessSession;
    thread?: ChatThread;
  }): Promise<void>;
}

export function createConversationFinalizationService(dependencies: {
  ideaExtractionService: IdeaExtractionService;
  notionAdapter: NotionProviderAdapter;
  persistenceService: ConversationPersistenceService;
}): ConversationFinalizationService {
  return {
    async finalizeConversation({ threadId, closeReason, session, thread }) {
      if (session && thread) {
        await dependencies.persistenceService.saveThreadSnapshot({ session, thread });
      }

      await dependencies.persistenceService.queueExport(threadId, closeReason);

      const conversation = await dependencies.persistenceService.loadConversationExportPayload(threadId);

      if (!conversation) {
        return;
      }

      if (conversation.exportState.status === "sent" && conversation.thread.notionStatus === "Transcript synced") {
        return;
      }

      try {
        const ideas = await dependencies.ideaExtractionService.extractIdeas(conversation);
        const exportResult = await dependencies.notionAdapter.exportConversation({
          conversation,
          ideas,
          closeReason
        });

        await dependencies.persistenceService.markConversationExported({
          threadId,
          transcriptPageId: exportResult.transcriptPageId,
          ideaPageIds: exportResult.ideaPageIds,
          ideaCount: ideas.length
        });
      } catch (error) {
        await dependencies.persistenceService.markConversationExportFailed({
          threadId,
          errorMessage: error instanceof Error ? error.message : "Unknown finalization error."
        });
        throw error;
      }
    }
  };
}
