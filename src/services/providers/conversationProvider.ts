import type { ChatMessage, ChatThread, OrchestrationDecision, PendingAttachmentDraft } from "../../lib/types";

export interface ConversationProviderAdapter {
  createAssistantMessage(args: {
    thread: ChatThread;
    userMessage: ChatMessage;
    decision: OrchestrationDecision;
    attachments: PendingAttachmentDraft[];
  }): Promise<ChatMessage>;
}
