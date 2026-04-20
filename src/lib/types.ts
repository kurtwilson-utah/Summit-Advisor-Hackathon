export type {
  AgentKey,
  AgentStatus,
  ChatContextItemPayload,
  HiddenHostPageContextPayload,
  OrchestrationDecision,
  ThinkingStepDefinition
} from "../../shared/chat";
export type {
  ActiveThinkingState,
  AttachmentKind,
  ChatMessage,
  ChatThread,
  DraftAttachment,
  EmailAccessSession,
  RedactionBundle,
  RedactionEntity,
  RedactionEntityType,
  ThreadAgentState
} from "../../shared/thread";
import type { DraftAttachment } from "../../shared/thread";

export interface ThemeSettings {
  name: string;
  fontDisplay: string;
  fontBody: string;
  backgroundCanvas: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  sidebar: string;
  border: string;
  divider: string;
  textStrong: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  userBubble: string;
  assistantBubble: string;
  assistantAvatar: string;
  success: string;
  warning: string;
  shadow: string;
  bubbleShadow: string;
}

export interface PendingAttachmentDraft extends DraftAttachment {
  file: File;
}
