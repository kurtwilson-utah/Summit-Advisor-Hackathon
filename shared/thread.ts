import type { AgentKey, AgentStatus, ThinkingStepDefinition } from "./chat.js";

export type AttachmentKind = "image" | "pdf" | "word" | "excel" | "video" | "other";

export type RedactionEntityType = "email" | "phone" | "address" | "name";

export interface DraftAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeLabel: string;
  kind: AttachmentKind;
}

export interface RedactionEntity {
  id: string;
  type: RedactionEntityType;
  placeholder: string;
  original: string;
  start: number;
  end: number;
}

export interface RedactionBundle {
  redactedText: string;
  entities: RedactionEntity[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  authorLabel: string;
  bodyDisplay: string;
  bodyModel?: string;
  createdAt: string;
  agentKey?: AgentKey;
  attachments?: DraftAttachment[];
  redaction?: RedactionBundle;
}

export interface ThreadAgentState {
  key: AgentKey;
  label: string;
  status: AgentStatus;
  detail: string;
}

export interface ChatThread {
  id: string;
  title: string;
  statusLabel: string;
  updatedAt: string;
  summary: string;
  memoryDigest: string;
  notionStatus: string;
  messages: ChatMessage[];
  agentStates: ThreadAgentState[];
}

export interface ActiveThinkingState {
  threadId: string;
  step: ThinkingStepDefinition;
}

export interface EmailAccessSession {
  email: string;
  displayName: string;
  accessToken: string;
}
