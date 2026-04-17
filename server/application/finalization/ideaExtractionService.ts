import type { ClaudeProviderAdapter } from "../../providers/model/claudeProviderAdapter.js";
import type { ConversationExportPayload } from "../../providers/persistence/supabasePersistenceAdapter.js";

const ALLOWED_CATEGORIES = [
  "product catalogs and pricing",
  "project management",
  "post-sales tracking",
  "contact records",
  "measure mobile",
  "design flex",
  "proposals and sales orders",
  "customer experience and communication",
  "purchasing and receiving",
  "inventory and warehouse management",
  "scheduling and installation",
  "project financials - sales order close and profit reporting",
  "general accounting",
  "dashboard and reporting",
  "API and integrations",
  "AI"
] as const;

export interface ExtractedIdeaCandidate {
  conversedWith: string;
  problemStatement: string;
  ideaStatement: string;
  keyQuotes: string[];
  category: (typeof ALLOWED_CATEGORIES)[number];
  recommendedNextStep: string;
  confidence: "high" | "medium" | "low";
  sourceAgent: "Summit Product Manager";
}

export interface IdeaExtractionService {
  extractIdeas(conversation: ConversationExportPayload): Promise<ExtractedIdeaCandidate[]>;
}

export function createIdeaExtractionService(dependencies: {
  claudeAdapter: ClaudeProviderAdapter;
}): IdeaExtractionService {
  return {
    async extractIdeas(conversation) {
      const response = await dependencies.claudeAdapter.complete({
        systemPrompt: [
          "You extract product ideas from customer conversations.",
          "Return strict JSON only.",
          'Use the shape: {"ideas":[{"conversedWith":"","problemStatement":"","ideaStatement":"","keyQuotes":[],"category":"","recommendedNextStep":"","confidence":"","sourceAgent":"Summit Product Manager"}]}',
          "If there are no meaningful product ideas, return {\"ideas\":[]}.",
          "Do not invent quotes or ideas.",
          `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`
        ].join("\n"),
        userPrompt: buildExtractionPrompt(conversation),
        maxTokens: 1200,
        temperature: 0
      });

      return normalizeIdeaCandidates(parseIdeaResponse(response), conversation.session.displayName);
    }
  };
}

function buildExtractionPrompt(conversation: ConversationExportPayload) {
  const transcript = conversation.thread.messages
    .map((message) => `${message.authorLabel} (${message.role}): ${message.bodyDisplay}`)
    .join("\n\n");

  return [
    `Thread title: ${conversation.thread.title}`,
    `Participant name: ${conversation.session.displayName}`,
    `Participant email: ${conversation.session.email}`,
    `Thread summary: ${conversation.thread.summary}`,
    "Transcript:",
    transcript
  ].join("\n\n");
}

function parseIdeaResponse(response: string): unknown {
  const fencedJsonMatch = response.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedJsonMatch?.[1] ?? response;

  return JSON.parse(candidate);
}

function normalizeIdeaCandidates(response: unknown, fallbackName: string): ExtractedIdeaCandidate[] {
  if (
    typeof response !== "object" ||
    response === null ||
    !("ideas" in response) ||
    !Array.isArray((response as { ideas?: unknown[] }).ideas)
  ) {
    return [];
  }

  return (response as { ideas: unknown[] }).ideas
    .map((idea) => normalizeIdeaCandidate(idea, fallbackName))
    .filter((idea): idea is ExtractedIdeaCandidate => Boolean(idea));
}

function normalizeIdeaCandidate(candidate: unknown, fallbackName: string): ExtractedIdeaCandidate | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const problemStatement = asString(record.problemStatement);
  const ideaStatement = asString(record.ideaStatement);
  const category = asCategory(record.category);

  if (!problemStatement || !ideaStatement || !category) {
    return null;
  }

  return {
    conversedWith: asString(record.conversedWith) || fallbackName,
    problemStatement,
    ideaStatement,
    keyQuotes: Array.isArray(record.keyQuotes) ? record.keyQuotes.map(asString).filter(Boolean) : [],
    category,
    recommendedNextStep: asString(record.recommendedNextStep) || "Review with a Summit Product Manager.",
    confidence: asConfidence(record.confidence),
    sourceAgent: "Summit Product Manager"
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asCategory(value: unknown): ExtractedIdeaCandidate["category"] | null {
  const normalized = asString(value);

  return (ALLOWED_CATEGORIES as readonly string[]).includes(normalized)
    ? (normalized as ExtractedIdeaCandidate["category"])
    : null;
}

function asConfidence(value: unknown): ExtractedIdeaCandidate["confidence"] {
  const normalized = asString(value).toLowerCase();

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "medium";
}
