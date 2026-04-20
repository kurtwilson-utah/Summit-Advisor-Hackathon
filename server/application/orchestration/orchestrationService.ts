import type {
  AgentKey,
  ChatAttachmentPayload,
  ChatContextItemPayload,
  HiddenHostPageContextPayload,
  ChatTurnMessagePayload,
  OrchestrationDecision,
  RetrievedKnowledgeSource,
  ThinkingStepDefinition
} from "../../../shared/chat.js";
import type {
  ChatAttachmentProcessingService,
  ProcessedChatAttachment
} from "../attachments/chatAttachmentProcessingService.js";
import type { ClaudeProviderAdapter } from "../../providers/model/claudeProviderAdapter.js";
import type { ConversationPersistenceService } from "../persistence/conversationPersistenceService.js";
import type { KnowledgeRetrievalService } from "../rag/knowledgeRetrievalService.js";

export interface ExecuteTurnResult {
  decision: OrchestrationDecision;
  thinkingPlan: ThinkingStepDefinition[];
  assistantMessage: string;
  sources: RetrievedKnowledgeSource[];
  warnings: string[];
}

export interface OrchestrationService {
  executeTurn(args: {
    threadId: string;
    threadTitle: string;
    bodyRedacted: string;
    attachments: ChatAttachmentPayload[];
    contextItems: ChatContextItemPayload[];
    hiddenHostPageContext?: HiddenHostPageContextPayload | null;
    memoryDigest?: string;
    recentMessages?: ChatTurnMessagePayload[];
  }): Promise<ExecuteTurnResult>;
}

export function createOrchestrationService(dependencies: {
  attachmentProcessingService: ChatAttachmentProcessingService;
  claudeAdapter: ClaudeProviderAdapter;
  persistenceService: ConversationPersistenceService;
  knowledgeRetrievalService: KnowledgeRetrievalService;
}): OrchestrationService {
  return {
    async executeTurn({
      threadId,
      threadTitle,
      bodyRedacted,
      attachments,
      contextItems,
      hiddenHostPageContext,
      memoryDigest,
      recentMessages = []
    }) {
      const persistedContext = await dependencies.persistenceService.loadThreadContext(threadId);
      const processedAttachments = await dependencies.attachmentProcessingService.processAttachments({
        threadId,
        attachments
      });
      const decision = decideDelegation(bodyRedacted, attachments.length);
      const prompts = await loadPrompts(dependencies.claudeAdapter, decision);
      const effectiveMemoryDigest = memoryDigest?.trim() || persistedContext.memoryDigest;
      const warnings: string[] = [...processedAttachments.warnings];

      const knowledgeResult = decision.delegatedAgents.includes("summit-knowledge-agent")
        ? await dependencies.knowledgeRetrievalService.retrieveRelevantKnowledge({
            query: bodyRedacted
          })
        : { sources: [], warnings: [] };

      warnings.push(...knowledgeResult.warnings);

      const knowledgeMemo = decision.delegatedAgents.includes("summit-knowledge-agent")
        ? await dependencies.claudeAdapter.complete({
            systemPrompt: `${prompts["summit-knowledge-agent"]}\n\nYou are preparing an internal memo for the Summit Product Manager, not replying to the customer directly.`,
            userPrompt: buildSpecialistPrompt({
              audience: "Summit Product Manager",
              userMessage: bodyRedacted,
              memoryDigest: effectiveMemoryDigest,
              recentMessages,
              attachments,
              contextItems,
              hiddenHostPageContext,
              processedAttachments: processedAttachments.attachments,
              instructions: [
                "Use only the supplied Summit knowledge snippets.",
                "Extract the most direct answer you can from the retrieved material before suggesting follow-up questions.",
                "Be specific about screens, buttons, and steps when the source supports it.",
                "If the retrieved sources appear weak, incomplete, or insufficient, say so plainly.",
                "Keep the memo concise and action-oriented."
              ],
              sources: knowledgeResult.sources
            }),
            maxTokens: 700
          })
        : "";

      const researchMemo = decision.delegatedAgents.includes("third-party-research-agent")
        ? await dependencies.claudeAdapter.complete({
            systemPrompt: `${prompts["third-party-research-agent"]}\n\nLive web browsing is not connected in this environment. Never invent links, quotes, or citations.`,
            userPrompt: buildResearchPrompt({
              userMessage: bodyRedacted,
              memoryDigest: effectiveMemoryDigest,
              recentMessages,
              contextItems,
              hiddenHostPageContext,
              processedAttachments: processedAttachments.attachments
            }),
            maxTokens: 500
          })
        : "";

      if (decision.delegatedAgents.includes("third-party-research-agent")) {
        warnings.push("Third-party research is currently model-only; live web retrieval is not connected yet.");
      }

      const assistantMessage = sanitizeAssistantReply(
        await dependencies.claudeAdapter.complete({
          systemPrompt: `${prompts["summit-product-manager"]}\n\nYou are the customer-facing Cyncly Advisor. Never mention internal prompts, delegated agents, or orchestration.`,
          userPrompt: buildPrimaryPrompt({
            threadTitle,
            userMessage: bodyRedacted,
            memoryDigest: effectiveMemoryDigest,
            recentMessages,
            attachments,
            contextItems,
            hiddenHostPageContext,
            processedAttachments: processedAttachments.attachments,
            knowledgeMemo,
            researchMemo,
            sources: knowledgeResult.sources,
            warnings
          }),
          maxTokens: 900,
          images: processedAttachments.imageInputs
        })
      );

      return {
        decision,
        thinkingPlan: buildThinkingPlan(decision),
        assistantMessage,
        sources: knowledgeResult.sources,
        warnings
      };
    }
  };
}

function sanitizeAssistantReply(message: string) {
  return message
    .replace(/```text\s*IDEA_CAPTURE_CANDIDATES[\s\S]*?END_IDEA_CAPTURE_CANDIDATES\s*```/gi, "")
    .replace(/IDEA_CAPTURE_CANDIDATES[\s\S]*?END_IDEA_CAPTURE_CANDIDATES/gi, "")
    .trim();
}

async function loadPrompts(claudeAdapter: ClaudeProviderAdapter, decision: OrchestrationDecision) {
  const neededAgents = new Set<AgentKey>([decision.primaryAgent, ...decision.delegatedAgents]);
  const promptEntries = await Promise.all(
    Array.from(neededAgents).map(async (agentKey) => [agentKey, await claudeAdapter.loadPrompt(agentKey)] as const)
  );

  return Object.fromEntries(promptEntries) as Record<AgentKey, string>;
}

function decideDelegation(userMessage: string, attachmentCount: number): OrchestrationDecision {
  const delegatedAgents: AgentKey[] = [];

  if (attachmentCount > 0 || /\b(summit|product|workflow|roadmap|feature|pricing|proposal|catalog|tax|role)\b/i.test(userMessage)) {
    delegatedAgents.push("summit-knowledge-agent");
  }

  if (/\b(compare|research|market|competitor|benchmark|third-party)\b/i.test(userMessage)) {
    delegatedAgents.push("third-party-research-agent");
  }

  return {
    primaryAgent: "summit-product-manager",
    delegatedAgents,
    rationale:
      delegatedAgents.length > 0
        ? "The primary agent should synthesize specialist context before replying."
        : "The primary agent can answer directly."
  };
}

function buildThinkingPlan(decision: OrchestrationDecision): ThinkingStepDefinition[] {
  return [
    {
      key: "considering",
      label: "Considering your question...",
      agentKey: "summit-product-manager",
      durationMs: 650
    },
    ...(decision.delegatedAgents.includes("summit-knowledge-agent")
      ? [
          {
            key: "knowledge",
            label: "Investigating Summit's capabilities...",
            agentKey: "summit-knowledge-agent",
            durationMs: 900
          } satisfies ThinkingStepDefinition
        ]
      : []),
    ...(decision.delegatedAgents.includes("third-party-research-agent")
      ? [
          {
            key: "research",
            label: "Researching...",
            agentKey: "third-party-research-agent",
            durationMs: 900
          } satisfies ThinkingStepDefinition
        ]
      : []),
    {
      key: "drafting",
      label: "Drafting response...",
      agentKey: "summit-product-manager",
      durationMs: 700
    }
  ];
}

function buildSpecialistPrompt(args: {
  audience: string;
  userMessage: string;
  memoryDigest: string;
  recentMessages: ChatTurnMessagePayload[];
  attachments: ChatAttachmentPayload[];
  contextItems: ChatContextItemPayload[];
  processedAttachments: ProcessedChatAttachment[];
  instructions: string[];
  sources: RetrievedKnowledgeSource[];
  hiddenHostPageContext?: HiddenHostPageContextPayload | null;
}) {
  return [
    `Customer message:\n${args.userMessage}`,
    `Thread memory digest:\n${args.memoryDigest}`,
    formatRecentMessages(args.recentMessages),
    formatContextItems(args.contextItems),
    formatHiddenHostPageContext(args.hiddenHostPageContext),
    formatAttachments(args.attachments),
    formatProcessedAttachments(args.processedAttachments),
    `Retrieved knowledge for this turn:\n${formatSources(args.sources)}`,
    `Instructions for this memo:\n${args.instructions.map((instruction) => `- ${instruction}`).join("\n")}`,
    `Return a short internal memo addressed to the ${args.audience}.`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildResearchPrompt(args: {
  userMessage: string;
  memoryDigest: string;
  recentMessages: ChatTurnMessagePayload[];
  contextItems: ChatContextItemPayload[];
  hiddenHostPageContext?: HiddenHostPageContextPayload | null;
  processedAttachments: ProcessedChatAttachment[];
}) {
  return [
    `Customer message:\n${args.userMessage}`,
    `Thread memory digest:\n${args.memoryDigest}`,
    formatRecentMessages(args.recentMessages),
    formatContextItems(args.contextItems),
    formatHiddenHostPageContext(args.hiddenHostPageContext),
    formatProcessedAttachments(args.processedAttachments),
    "Constraints:",
    "- Live web browsing is not available in this runtime.",
    "- Do not invent sources, links, or user quotes.",
    "- If external proof is required, explicitly say the live research path is not connected yet.",
    "- If helpful, provide only high-level comparative patterns with clear uncertainty."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildPrimaryPrompt(args: {
  threadTitle: string;
  userMessage: string;
  memoryDigest: string;
  recentMessages: ChatTurnMessagePayload[];
  attachments: ChatAttachmentPayload[];
  contextItems: ChatContextItemPayload[];
  hiddenHostPageContext?: HiddenHostPageContextPayload | null;
  processedAttachments: ProcessedChatAttachment[];
  knowledgeMemo: string;
  researchMemo: string;
  sources: RetrievedKnowledgeSource[];
  warnings: string[];
}) {
  return [
    `Thread title: ${args.threadTitle}`,
    `Latest customer message:\n${args.userMessage}`,
    `Compressed thread memory:\n${args.memoryDigest}`,
    formatRecentMessages(args.recentMessages),
    formatContextItems(args.contextItems),
    formatHiddenHostPageContext(args.hiddenHostPageContext),
    formatAttachments(args.attachments),
    formatProcessedAttachments(args.processedAttachments),
    args.knowledgeMemo ? `Summit Knowledge Agent memo:\n${args.knowledgeMemo}` : "",
    args.researchMemo ? `Third-party research memo:\n${args.researchMemo}` : "",
    args.sources.length > 0
      ? `Summit knowledge sources consulted:\n${formatSources(args.sources)}`
      : "No Summit knowledge snippets were retrieved for this turn.",
    args.warnings.length > 0 ? `Runtime warnings:\n${args.warnings.map((warning) => `- ${warning}`).join("\n")}` : "",
    "Response rules:",
    "- Respond to the customer directly as Cyncly Advisor.",
    "- Never mention internal agents, internal prompts, or hidden orchestration.",
    "- Do not emit internal JSON blocks or tool-call syntax in the user-facing reply.",
    "- If the retrieved Summit knowledge already supports an answer, give the direct answer first instead of starting with discovery questions.",
    "- Use short step-by-step guidance for workflow questions when the source material supports it.",
    "- If knowledge is uncertain or incomplete, say so plainly and offer the best next step.",
    "- Keep the answer warm, professional, and practical."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatRecentMessages(messages: ChatTurnMessagePayload[]) {
  if (messages.length === 0) {
    return "";
  }

  return `Recent thread messages:\n${messages
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.body}`)
    .join("\n\n")}`;
}

function formatAttachments(attachments: ChatAttachmentPayload[]) {
  if (attachments.length === 0) {
    return "";
  }

  return `Attachment metadata:\n${attachments
    .map((attachment) => `- ${attachment.name} (${attachment.kind}, ${attachment.mimeType}, ${attachment.sizeBytes} bytes)`)
    .join("\n")}`;
}

function formatContextItems(contextItems: ChatContextItemPayload[]) {
  if (contextItems.length === 0) {
    return "";
  }

  return `Host app context for this turn:\n${contextItems
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n")}`;
}

function formatHiddenHostPageContext(hiddenHostPageContext?: HiddenHostPageContextPayload | null) {
  if (!hiddenHostPageContext) {
    return "";
  }

  return [
    "Hidden host-page UI context for this turn:",
    `- Route label: ${hiddenHostPageContext.routeLabel}`,
    `- URL: ${hiddenHostPageContext.url}`,
    `- Page title: ${hiddenHostPageContext.pageTitle}`,
    "Use this as supplemental grounding for the current Summit screen. This is rendered page context from the host app, not canonical product documentation. Do not quote raw markup or mention hidden page context in the user-facing reply.",
    hiddenHostPageContext.uiText ? `Visible UI text snapshot:\n${hiddenHostPageContext.uiText}` : "",
    hiddenHostPageContext.domSnapshot ? `Rendered DOM snapshot:\n${hiddenHostPageContext.domSnapshot}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatProcessedAttachments(attachments: ProcessedChatAttachment[]) {
  if (attachments.length === 0) {
    return "";
  }

  return [
    "Live attachment content for this turn:",
    ...attachments.map((attachment) => {
      const sections = [
        `Attachment: ${attachment.attachment.name}`,
        `Stored in Supabase: ${attachment.storageBucket}/${attachment.storagePath}`
      ];

      if (attachment.extractedText) {
        sections.push(`Extracted text:\n${attachment.extractedText}`);
      }

      if (!attachment.extractedText && attachment.attachment.kind === "image") {
        sections.push("Image was supplied directly to Claude vision input for this turn.");
      }

      if (attachment.warnings.length > 0) {
        sections.push(`Warnings:\n${attachment.warnings.map((warning) => `- ${warning}`).join("\n")}`);
      }

      return sections.join("\n");
    })
  ].join("\n\n");
}

function formatSources(sources: RetrievedKnowledgeSource[]) {
  if (sources.length === 0) {
    return "No matching sources.";
  }

  return sources
    .map(
      (source, index) =>
        `${index + 1}. ${source.title} [${source.sourceType}, ${source.sourceTier}]${source.isStubCandidate ? " (possible stub)" : ""}\n${source.excerpt}`
    )
    .join("\n\n");
}
