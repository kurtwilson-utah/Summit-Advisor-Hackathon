import type {
  ChatContextItemPayload,
  HiddenHostPageContextPayload,
  ChatMessage,
  ChatThread,
  OrchestrationDecision,
  PendingAttachmentDraft
} from "../../lib/types";

export interface ConversationProviderAdapter {
  createAssistantMessage(args: {
    thread: ChatThread;
    userMessage: ChatMessage;
    decision: OrchestrationDecision;
    attachments: PendingAttachmentDraft[];
    contextItems: ChatContextItemPayload[];
    hiddenHostPageContext: HiddenHostPageContextPayload | null;
  }): Promise<ChatMessage>;
}
