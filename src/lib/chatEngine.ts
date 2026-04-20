import type {
  AgentKey,
  ChatMessage,
  ChatThread,
  DraftAttachment,
  PendingAttachmentDraft,
  ThreadAgentState
} from "./types";

const AGENT_LABELS: Record<AgentKey, string> = {
  "summit-product-manager": "Summit Product Manager",
  "summit-knowledge-agent": "Summit Knowledge Agent",
  "third-party-research-agent": "Third-Party Research Agent"
};

export function describeAttachmentKind(file: File): DraftAttachment["kind"] {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.includes("pdf")) {
    return "pdf";
  }

  if (file.type.includes("word") || file.name.endsWith(".docx")) {
    return "word";
  }

  if (file.type.includes("sheet") || file.name.endsWith(".xlsx") || file.name.endsWith(".csv")) {
    return "excel";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return "other";
}

export function formatBytes(size: number): string {
  if (size === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function createAttachmentDraft(file: File): PendingAttachmentDraft {
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    sizeLabel: formatBytes(file.size),
    kind: describeAttachmentKind(file)
  };
}

export function stripPendingAttachment(attachment: PendingAttachmentDraft): DraftAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    sizeLabel: attachment.sizeLabel,
    kind: attachment.kind
  };
}

export function formatTimestamp(dateIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function formatHistoryTimestamp(dateIso: string): string {
  const targetDate = new Date(dateIso);
  const deltaMs = targetDate.getTime() - Date.now();
  const absoluteDeltaMs = Math.abs(deltaMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  // Recent chats feel better with relative time, but older ones should stabilize to a date.
  if (absoluteDeltaMs < 7 * dayMs) {
    const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

    if (absoluteDeltaMs < hourMs) {
      return formatter.format(Math.round(deltaMs / minuteMs), "minute");
    }

    if (absoluteDeltaMs < dayMs) {
      return formatter.format(Math.round(deltaMs / hourMs), "hour");
    }

    return formatter.format(Math.round(deltaMs / dayMs), "day");
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: targetDate.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
  }).format(targetDate);
}

export function getAgentLabel(agentKey: AgentKey): string {
  return AGENT_LABELS[agentKey];
}

export function createIdleAgentStates(): ThreadAgentState[] {
  return [
    {
      key: "summit-product-manager",
      label: AGENT_LABELS["summit-product-manager"],
      status: "ready",
      detail: "Awaiting the next user request."
    },
    {
      key: "summit-knowledge-agent",
      label: AGENT_LABELS["summit-knowledge-agent"],
      status: "idle",
      detail: "No active turn."
    },
    {
      key: "third-party-research-agent",
      label: AGENT_LABELS["third-party-research-agent"],
      status: "idle",
      detail: "No active turn."
    }
  ];
}

export function createEmptyThread(displayName?: string | null): ChatThread {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    statusLabel: "Draft",
    updatedAt: now,
    summary: "Fresh thread waiting for the first message.",
    memoryDigest: "No hidden summary yet.",
    notionStatus: "Not exported",
    agentStates: createIdleAgentStates(),
    messages: []
  };
}

export function isUnsentDraftThread(thread: ChatThread): boolean {
  return thread.title === "New conversation" && getVisibleThreadMessages(thread).length === 0;
}

export function hasUserStartedThread(thread: ChatThread): boolean {
  return thread.messages.some((message) => message.role === "user");
}

export function hasPersistableThreadHistory(thread: ChatThread): boolean {
  return getVisibleThreadMessages(thread).length > 0;
}

export function getThreadActivityTimestamp(thread: ChatThread): string {
  return thread.messages[thread.messages.length - 1]?.createdAt ?? thread.updatedAt;
}

export function normalizeThreadCollection(threads: ChatThread[]): ChatThread[] {
  const sortedThreads = [...threads].sort(compareThreadsByRecency);
  const normalizedThreads: ChatThread[] = [];
  let keptDraft = false;

  for (const thread of sortedThreads) {
    if (isUnsentDraftThread(thread)) {
      if (keptDraft) {
        continue;
      }

      keptDraft = true;
    }

    normalizedThreads.push(thread);
  }

  return normalizedThreads;
}

export function sortThreadsByRecentActivity(threads: ChatThread[]): ChatThread[] {
  return normalizeThreadCollection(threads);
}

export function filterPersistableThreads(threads: ChatThread[]): ChatThread[] {
  return normalizeThreadCollection(threads.filter(hasPersistableThreadHistory));
}

export function summarizeThread(messages: ChatMessage[]): string {
  const visibleMessages = messages.filter((message) => message.role !== "system");
  const lastMessages = visibleMessages.slice(-4);

  if (!lastMessages.length) {
    return "New thread. No compressed memory yet.";
  }

  return lastMessages
    .map((message) => `${message.authorLabel}: ${message.bodyDisplay.slice(0, 110)}`)
    .join(" | ");
}

export function getEmptyThreadGreeting(displayName?: string | null) {
  const greetingName = deriveGreetingName(displayName);
  const greetingPrefix = greetingName ? `Hi, ${greetingName}!` : "Hi!";

  return `${greetingPrefix} I can help answer questions about Summit, and can submit ideas on your behalf. What can I help you with today?`;
}

export function getVisibleThreadMessages(thread: ChatThread): ChatMessage[] {
  return thread.messages.filter((message, index) => !isHiddenAdvisorGreetingMessage(message, index));
}

export function isHiddenAdvisorGreetingMessage(message: ChatMessage, index?: number) {
  if (message.role !== "assistant" || message.authorLabel !== "Cyncly Advisor") {
    return false;
  }

  if (typeof index === "number" && index !== 0) {
    return false;
  }

  return /I can help answer questions about Summit, and can submit ideas on your behalf\. What can I help you with today\?/i.test(
    message.bodyDisplay
  );
}

export function deriveThreadTitle(currentTitle: string, newestUserText: string): string {
  if (currentTitle !== "New conversation") {
    return currentTitle;
  }

  const trimmed = newestUserText.trim();

  if (!trimmed) {
    return currentTitle;
  }

  return `${trimmed.slice(0, 42)}${trimmed.length > 42 ? "..." : ""}`;
}

function compareThreadsByRecency(left: ChatThread, right: ChatThread): number {
  const leftIsDraft = isUnsentDraftThread(left);
  const rightIsDraft = isUnsentDraftThread(right);

  if (leftIsDraft !== rightIsDraft) {
    return leftIsDraft ? -1 : 1;
  }

  return new Date(getThreadActivityTimestamp(right)).getTime() - new Date(getThreadActivityTimestamp(left)).getTime();
}

function deriveGreetingName(displayName?: string | null): string | null {
  const trimmed = displayName?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] ?? null;
}
