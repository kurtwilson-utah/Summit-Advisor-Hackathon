import type { ChatThread } from "../lib/types";

const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const mockThreads: ChatThread[] = [
  {
    id: crypto.randomUUID(),
    title: "Summit launch assistant",
    statusLabel: "Live draft",
    updatedAt: minutesAgo(9),
    summary: "Theme-ready shell, multi-agent orchestration, and secure redaction are being assembled.",
    memoryDigest:
      "User wants a branded chatbot interface named Cyncly Advisor with multi-thread history, attachment support, Claude routing, Notion exports, and protected RAG.",
    notionStatus: "Idea capture pending",
    agentStates: [
      {
        key: "summit-product-manager",
        label: "Summit Product Manager",
        status: "working",
        detail: "Coordinating the response and routing sub-tasks."
      },
      {
        key: "summit-knowledge-agent",
        label: "Summit Knowledge Agent",
        status: "ready",
        detail: "Prepared to answer with internal Summit context."
      },
      {
        key: "third-party-research-agent",
        label: "Third-Party Research Agent",
        status: "ready",
        detail: "Prepared to bring in competitor or market context."
      }
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        authorLabel: "Cyncly Advisor",
        bodyDisplay:
          "Welcome back. This thread is configured to route through the Summit Product Manager prompt while keeping room for private retrieval and post-conversation Notion syncs.",
        createdAt: minutesAgo(15),
        agentKey: "summit-product-manager"
      },
      {
        id: crypto.randomUUID(),
        role: "user",
        authorLabel: "You",
        bodyDisplay:
          "I need a web app chatbot interface with multiple chats, secure document retrieval, and a way to hand work to the knowledge and research agents.",
        bodyModel:
          "I need a web app chatbot interface with multiple chats, secure document retrieval, and a way to hand work to the knowledge and research agents.",
        createdAt: minutesAgo(12)
      }
    ]
  },
  {
    id: crypto.randomUUID(),
    title: "Idea capture flow",
    statusLabel: "Idle",
    updatedAt: minutesAgo(160),
    summary: "Conversation-close hooks should send a transcript plus extracted ideas to two separate Notion databases.",
    memoryDigest:
      "Need a durable finalize-thread flow that also works when the browser tab closes or the user goes idle.",
    notionStatus: "Transcript synced",
    agentStates: [
      {
        key: "summit-product-manager",
        label: "Summit Product Manager",
        status: "ready",
        detail: "No active turn."
      },
      {
        key: "summit-knowledge-agent",
        label: "Summit Knowledge Agent",
        status: "idle",
        detail: "No active turn."
      },
      {
        key: "third-party-research-agent",
        label: "Third-Party Research Agent",
        status: "idle",
        detail: "No active turn."
      }
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        authorLabel: "Cyncly Advisor",
        bodyDisplay:
          "The finalizer should run on explicit thread close, idle timeout, and a browser unload beacon so chat-log exports are hard to miss.",
        createdAt: minutesAgo(175),
        agentKey: "summit-product-manager"
      }
    ]
  },
  {
    id: crypto.randomUUID(),
    title: "RAG intake",
    statusLabel: "Idle",
    updatedAt: minutesAgo(1440),
    summary: "Private documents belong in a backend bucket, not in the browser bundle or a public repo.",
    memoryDigest:
      "Need an ingestion flow for PDFs, Word, Excel, images, and video transcripts before RAG retrieval is enabled.",
    notionStatus: "Not exported",
    agentStates: [
      {
        key: "summit-product-manager",
        label: "Summit Product Manager",
        status: "ready",
        detail: "No active turn."
      },
      {
        key: "summit-knowledge-agent",
        label: "Summit Knowledge Agent",
        status: "ready",
        detail: "Ready to interpret private documents once ingested."
      },
      {
        key: "third-party-research-agent",
        label: "Third-Party Research Agent",
        status: "idle",
        detail: "No active turn."
      }
    ],
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        authorLabel: "Cyncly Advisor",
        bodyDisplay:
          "For RAG, upload the source files to a private bucket, extract text server-side, chunk them, and only then make the chunks retrievable by the orchestrator.",
        createdAt: minutesAgo(1490),
        agentKey: "summit-product-manager"
      }
    ]
  }
];
