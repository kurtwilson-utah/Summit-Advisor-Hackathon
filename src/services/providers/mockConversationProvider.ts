import { getAgentLabel } from "../../lib/chatEngine";
import type { ChatMessage } from "../../lib/types";
import type { ConversationProviderAdapter } from "./conversationProvider";

export function createMockConversationProvider(): ConversationProviderAdapter {
  return {
    async createAssistantMessage({ thread, userMessage, decision, attachments, contextItems, hiddenHostPageContext }) {
      const delegatedLabels = decision.delegatedAgents.map(getAgentLabel);

      const delegatedLine = delegatedLabels.length
        ? `For this turn, the Summit Product Manager consulted ${delegatedLabels.join(" and ")} before replying as Cyncly Advisor.`
        : "For this turn, the Summit Product Manager was able to answer directly as Cyncly Advisor.";

      const attachmentLine = attachments.length
        ? `I noticed ${attachments.length} uploaded file${attachments.length === 1 ? "" : "s"} and would route them through the private RAG pipeline before a live Claude call.`
        : "This request does not need file retrieval yet, so the turn can run from prompts plus compressed thread memory.";
      const contextLine = contextItems.length
        ? `This turn also received host context: ${contextItems.map((item) => item.label).join(", ")}.`
        : "No host-app context was supplied for this turn.";
      const hiddenContextLine = hiddenHostPageContext
        ? `A hidden host-page snapshot was also supplied for route ${hiddenHostPageContext.routeLabel}.`
        : "No hidden host-page snapshot was supplied for this turn.";

      return {
        id: crypto.randomUUID(),
        role: "assistant",
        authorLabel: "Cyncly Advisor",
        bodyDisplay: [
          "Here’s how this runtime is behaving right now:",
          delegatedLine,
          attachmentLine,
          contextLine,
          hiddenContextLine,
          `The current memory digest for this thread is: ${thread.memoryDigest}`,
          `The protected model payload for your latest message begins with: ${userMessage.bodyModel?.slice(0, 120) ?? "(no model payload recorded)"}`,
          "When we swap in the live adapters, this same contract becomes the Claude request plus persistence and finalization hooks."
        ].join("\n\n"),
        createdAt: new Date().toISOString(),
        agentKey: "summit-product-manager"
      };
    }
  };
}
