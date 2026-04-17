import type { ChatMessage, PendingAttachmentDraft } from "../../lib/types";
import type { ChatTurnRequest, ChatTurnResponse } from "../../../shared/chat";
import { postJson } from "../api/apiClient";
import type { ConversationProviderAdapter } from "./conversationProvider";

export function createApiConversationProvider(): ConversationProviderAdapter {
  return {
    async createAssistantMessage({ thread, userMessage, attachments }) {
      const totalAttachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);

      if (totalAttachmentBytes > 3_000_000) {
        throw new Error(
          "Live chat attachments currently support about 3 MB total per message. " +
            "Larger files should go into the private RAG bucket instead."
        );
      }

      const requestBody: ChatTurnRequest = {
        threadId: thread.id,
        threadTitle: thread.title,
        bodyRedacted: userMessage.bodyModel ?? userMessage.bodyDisplay,
        redactionMap: userMessage.redaction?.entities ?? [],
        attachments: await Promise.all(attachments.map(toAttachmentPayload)),
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

async function toAttachmentPayload(attachment: PendingAttachmentDraft) {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    sizeBytes: attachment.sizeBytes,
    dataBase64: await fileToBase64(attachment.file)
  };
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
