export type AgentKey =
  | "summit-product-manager"
  | "summit-knowledge-agent"
  | "third-party-research-agent";

export type AgentStatus = "idle" | "ready" | "working" | "waiting";

export type ThinkingStepKey = "considering" | "knowledge" | "research" | "drafting";

export interface OrchestrationDecision {
  primaryAgent: AgentKey;
  delegatedAgents: AgentKey[];
  rationale: string;
}

export interface ThinkingStepDefinition {
  key: ThinkingStepKey;
  label: string;
  agentKey: AgentKey;
  durationMs: number;
}

export interface ChatTurnMessagePayload {
  role: "user" | "assistant" | "system";
  body: string;
}

export interface ChatAttachmentPayload {
  id: string;
  name: string;
  mimeType: string;
  kind: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface RetrievedKnowledgeSource {
  documentId: string;
  title: string;
  sourceType: string;
  storagePath: string;
  excerpt: string;
  sourceTier: "preferred" | "fallback";
  isStubCandidate: boolean;
  score: number;
}

export interface ChatTurnRequest {
  threadId: string;
  threadTitle: string;
  bodyRedacted: string;
  redactionMap: unknown[];
  attachments: ChatAttachmentPayload[];
  memoryDigest: string;
  recentMessages: ChatTurnMessagePayload[];
}

export interface ChatTurnResponse {
  ok: true;
  status: "completed";
  orchestration: OrchestrationDecision;
  thinkingPlan: ThinkingStepDefinition[];
  message: string;
  sources: RetrievedKnowledgeSource[];
  warnings: string[];
}
