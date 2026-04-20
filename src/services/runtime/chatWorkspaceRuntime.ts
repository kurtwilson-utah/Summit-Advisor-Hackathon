import type { ThinkingStepDefinition } from "../../../shared/chat";
import {
  createEmptyThread,
  deriveThreadTitle,
  stripPendingAttachment,
  summarizeThread
} from "../../lib/chatEngine";
import { redactText } from "../../lib/piiRedaction";
import type { ChatContextItemPayload, ChatMessage, ChatThread, PendingAttachmentDraft } from "../../lib/types";
import type { ThreadFinalizationService } from "../finalization/threadFinalizationService";
import type { TurnOrchestrationService } from "../orchestration/turnOrchestrationService";
import type { ConversationProviderAdapter } from "../providers/conversationProvider";

export interface ChatWorkspaceRuntime {
  createThread(displayName?: string | null): ChatThread;
  submitTurn(args: {
    thread: ChatThread;
    draft: string;
    attachments: PendingAttachmentDraft[];
    contextItems: ChatContextItemPayload[];
    onOptimisticUpdate: (thread: ChatThread) => void;
    onThinkingStep: (step: ThinkingStepDefinition | null) => void;
    onComplete: (thread: ChatThread) => void;
  }): Promise<boolean>;
}

export function createChatWorkspaceRuntime(dependencies: {
  finalizationService: ThreadFinalizationService;
  orchestrationService: TurnOrchestrationService;
  providerAdapter: ConversationProviderAdapter;
}): ChatWorkspaceRuntime {
  return {
    createThread(displayName) {
      return createEmptyThread(displayName);
    },
    async submitTurn({ thread, draft, attachments, contextItems, onOptimisticUpdate, onThinkingStep, onComplete }) {
      const trimmedDraft = draft.trim();

      if (!trimmedDraft && attachments.length === 0) {
        return false;
      }

      const now = new Date().toISOString();
      const redaction = redactText(trimmedDraft);
      const storedAttachments = attachments.map(stripPendingAttachment);
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        authorLabel: "You",
        bodyDisplay: trimmedDraft || "Attached files",
        bodyModel: redaction.redactedText,
        createdAt: now,
        attachments: storedAttachments,
        redaction
      };

      const plannedTurn = dependencies.orchestrationService.planTurn(trimmedDraft, attachments);
      const threadWithUserMessage = dependencies.finalizationService.markPendingExport({
        ...thread,
        title: deriveThreadTitle(thread.title, trimmedDraft),
        updatedAt: now,
        statusLabel: "Thinking",
        summary: userMessage.bodyDisplay.slice(0, 90),
        memoryDigest: summarizeThread([...thread.messages, userMessage]),
        messages: [...thread.messages, userMessage],
        agentStates: plannedTurn.agentStates
      });

      onOptimisticUpdate(threadWithUserMessage);

      // Each step replaces the previous one so the user sees the active orchestration phase clearly.
      for (const step of plannedTurn.thinkingPlan) {
        onThinkingStep(step);
        await wait(step.durationMs);
      }

      let assistantMessage: ChatMessage;

      try {
        assistantMessage = await dependencies.providerAdapter.createAssistantMessage({
          thread: threadWithUserMessage,
          userMessage,
          decision: plannedTurn.decision,
          attachments,
          contextItems
        });
      } catch (error) {
        assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          authorLabel: "Cyncly Advisor",
          bodyDisplay:
            error instanceof Error
              ? `I hit a runtime issue before I could finish the reply.\n\n${error.message}`
              : "I hit a runtime issue before I could finish the reply.",
          createdAt: new Date().toISOString(),
          agentKey: "summit-product-manager"
        };
      }

      const nextMessages = [...threadWithUserMessage.messages, assistantMessage];
      const completedThread: ChatThread = {
        ...threadWithUserMessage,
        updatedAt: assistantMessage.createdAt,
        statusLabel: "Active",
        summary: assistantMessage.bodyDisplay.slice(0, 90),
        memoryDigest: summarizeThread(nextMessages),
        messages: nextMessages,
        agentStates: dependencies.orchestrationService.finalizeAgentStates(plannedTurn.agentStates)
      };

      onThinkingStep(null);
      onComplete(completedThread);
      return true;
    }
  };
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
