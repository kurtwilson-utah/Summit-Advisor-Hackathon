import { getVisibleThreadMessages, isUnsentDraftThread } from "./chatEngine";
import type { ChatContextItemPayload, ChatThread } from "./types";

export interface QuickReplyOption {
  id: string;
  label: string;
  value: string;
}

export const EMPTY_THREAD_QUICK_REPLY_TARGET = "empty-thread-placeholder";

export function deriveQuickReplies(args: {
  thread: ChatThread;
  contextItems: ChatContextItemPayload[];
  isEmbeddedMode: boolean;
}) {
  const visibleMessages = getVisibleThreadMessages(args.thread);
  const latestMessage = visibleMessages[visibleMessages.length - 1];

  if (args.isEmbeddedMode && isUnsentDraftThread(args.thread)) {
    const routeLabel = args.contextItems.find((item) => item.id === "current-page-title")?.value ?? null;
    const starterOptions = buildStarterQuickReplies(routeLabel);

    return starterOptions.length > 0
      ? {
          messageId: EMPTY_THREAD_QUICK_REPLY_TARGET,
          options: starterOptions
        }
      : null;
  }

  if (!latestMessage || latestMessage.role !== "assistant") {
    return null;
  }

  const binaryOptions = detectBinaryQuickReplies(latestMessage.bodyDisplay);

  return binaryOptions.length >= 2
    ? {
        messageId: latestMessage.id,
        options: binaryOptions
      }
    : null;
}

function buildStarterQuickReplies(routeLabel: string | null): QuickReplyOption[] {
  const normalizedRouteLabel = routeLabel?.trim() || "this page";
  const routeReference =
    normalizedRouteLabel.toLowerCase() === "home" ? "this page" : `the ${normalizedRouteLabel} page`;

  return [
    createQuickReplyOption(
      "starter-understand-page",
      `Help me understand ${routeReference}`,
      `Help me understand ${routeReference}.`
    ),
    createQuickReplyOption("starter-what-can-i-do", "What can I do from here?", "What can I do from here?"),
    createQuickReplyOption(
      "starter-what-should-check",
      "What should I check first?",
      `What should I check first on ${routeReference}?`
    )
  ];
}

function detectBinaryQuickReplies(messageBody: string): QuickReplyOption[] {
  const normalizedText = stripMarkdown(messageBody);
  const questionCandidates = normalizedText.match(/[^?\n]{3,180}\?/g) ?? [];
  const latestQuestion = questionCandidates[questionCandidates.length - 1]?.trim();

  if (!latestQuestion || !/\bor\b/i.test(latestQuestion)) {
    return [];
  }

  const patterns = [
    /^(?:would you (?:like|prefer)|do you want|are you looking for|is it|is this|should (?:i|we)|would it be more helpful to|would it be better to|does this need to be|did you mean)\s+(.+?)\s+or\s+(.+?)\?\s*$/i,
    /^(.+?)\s+or\s+(.+?)\?\s*$/i
  ];

  for (const pattern of patterns) {
    const match = latestQuestion.match(pattern);

    if (!match) {
      continue;
    }

    const leftOption = normalizeBinaryOption(match[1]);
    const rightOption = normalizeBinaryOption(match[2]);

    if (!leftOption || !rightOption) {
      continue;
    }

    if (countWords(leftOption) > 8 || countWords(rightOption) > 8) {
      continue;
    }

    return [
      createQuickReplyOption("binary-left", leftOption, leftOption),
      createQuickReplyOption("binary-right", rightOption, rightOption)
    ];
  }

  return [];
}

function stripMarkdown(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBinaryOption(value: string) {
  const normalized = value
    .replace(/^[\s"'`-]+|[\s"'`.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function countWords(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

function createQuickReplyOption(id: string, label: string, value: string): QuickReplyOption {
  return {
    id,
    label,
    value
  };
}
