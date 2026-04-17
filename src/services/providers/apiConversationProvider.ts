import type { ChatMessage, DraftAttachment } from "../../lib/types";
import type { ChatTurnRequest, ChatTurnResponse } from "../../../shared/chat";
import { postJson } from "../api/apiClient";
import type { ConversationProviderAdapter } from "./conversationProvider";

export function createApiConversationProvider(): ConversationProviderAdapter {
  return {
    async createAssistantMessage({ thread, userMessage, attachments }) {
      const requestBody: ChatTurnRequest = {
        threadId: thread.id,
        threadTitle: thread.title,
        bodyRedacted: userMessage.bodyModel ?? userMessage.bodyDisplay,
        redactionMap: userMessage.redaction?.entities ?? [],
        attachments: attachments.map(toAttachmentPayload),
        memoryDigest: thread.memoryDigest,
        recentMessages: thread.messages.slice(-6).map((message) => ({
          role: message.role,
          body: message.bodyModel ?? message.bodyDisplay
        }))
      };

      const payload = await postJson<ChatTurnResponse | { ok?: false; message?: string }>("/api/chat/send", requestBody);

      if (!("ok" in payload) || !payload.ok) {
        throw new Error("message" in payload ? payload.message ?? "Unable to get a reply." : "Unable to get a reply.");
      }

      return {
        id: crypto.randomUUID(),
        role: "assistant",
        authorLabel: "Cyncly Advisor",
        bodyDisplay: payload.message,
        createdAt: new Date().toISOString(),
        agentKey: payload.orchestration.primaryAgent
      };
    }
  };
}

function toAttachmentPayload(attachment: DraftAttachment) {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind
  };
}
