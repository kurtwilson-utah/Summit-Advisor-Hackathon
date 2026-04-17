import type { ChatMessage, ChatThread, DraftAttachment, OrchestrationDecision } from "../../lib/types";

export interface ConversationProviderAdapter {
  createAssistantMessage(args: {
    thread: ChatThread;
    userMessage: ChatMessage;
    decision: OrchestrationDecision;
    attachments: DraftAttachment[];
  }): Promise<ChatMessage>;
}
