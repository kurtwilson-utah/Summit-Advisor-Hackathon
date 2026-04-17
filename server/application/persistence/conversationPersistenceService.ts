import type {
  ConversationExportPayload,
  ConversationPersistenceAdapter,
  ThreadContextSnapshot
} from "../../providers/persistence/supabasePersistenceAdapter";
import type { ChatThread, EmailAccessSession } from "../../../shared/thread";

export interface ConversationPersistenceService {
  loadThreadContext(threadId: string): Promise<ThreadContextSnapshot>;
  listThreads(email: string): Promise<ChatThread[]>;
  saveThreadSnapshot(args: { session: EmailAccessSession; thread: ChatThread }): Promise<void>;
  queueExport(threadId: string, reason: string): Promise<void>;
  loadConversationExportPayload(threadId: string): Promise<ConversationExportPayload | null>;
  markConversationExported(args: {
    threadId: string;
    transcriptPageId: string;
    ideaPageIds: string[];
    ideaCount: number;
  }): Promise<void>;
  markConversationExportFailed(args: { threadId: string; errorMessage: string }): Promise<void>;
}

export function createConversationPersistenceService(dependencies: {
  adapter: ConversationPersistenceAdapter;
}): ConversationPersistenceService {
  return {
    async loadThreadContext(threadId) {
      return dependencies.adapter.loadThreadContext(threadId);
    },
    async listThreads(email) {
      return dependencies.adapter.listThreads(email);
    },
    async saveThreadSnapshot(args) {
      await dependencies.adapter.saveThreadSnapshot(args);
    },
    async queueExport(threadId, reason) {
      await dependencies.adapter.queueConversationExport({ threadId, reason });
    },
    async loadConversationExportPayload(threadId) {
      return dependencies.adapter.loadConversationExportPayload(threadId);
    },
    async markConversationExported(args) {
      await dependencies.adapter.markConversationExported(args);
    },
    async markConversationExportFailed(args) {
      await dependencies.adapter.markConversationExportFailed(args);
    }
  };
}
