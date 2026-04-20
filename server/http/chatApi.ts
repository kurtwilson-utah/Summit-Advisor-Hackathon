import type { ChatTurnResponse } from "../../shared/chat.js";
import type { ChatThread, EmailAccessSession } from "../../shared/thread.js";
import { z } from "zod";

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  kind: z.enum(["image", "pdf", "word", "excel", "video", "other"]),
  sizeBytes: z.number().nonnegative().default(0),
  dataBase64: z.string().default(""),
  sizeLabel: z.string().default("")
});

const redactionEntitySchema = z.object({
  id: z.string(),
  type: z.enum(["email", "phone", "address", "name"]),
  placeholder: z.string(),
  original: z.string(),
  start: z.number(),
  end: z.number()
});

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  authorLabel: z.string(),
  bodyDisplay: z.string(),
  bodyModel: z.string().optional(),
  createdAt: z.string(),
  agentKey: z.enum(["summit-product-manager", "summit-knowledge-agent", "third-party-research-agent"]).optional(),
  attachments: z.array(attachmentSchema).optional(),
  redaction: z
    .object({
      redactedText: z.string(),
      entities: z.array(redactionEntitySchema)
    })
    .optional()
});

const agentStateSchema = z.object({
  key: z.enum(["summit-product-manager", "summit-knowledge-agent", "third-party-research-agent"]),
  label: z.string(),
  status: z.enum(["idle", "ready", "working", "waiting"]),
  detail: z.string()
});

const contextItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string()
});

const hiddenHostPageContextSchema = z.object({
  routeLabel: z.string(),
  url: z.string(),
  pageTitle: z.string(),
  uiText: z.string(),
  domSnapshot: z.string()
});

const threadSchema = z.object({
  id: z.string(),
  title: z.string(),
  statusLabel: z.string(),
  updatedAt: z.string(),
  summary: z.string(),
  memoryDigest: z.string(),
  notionStatus: z.string(),
  messages: z.array(messageSchema),
  agentStates: z.array(agentStateSchema)
});

const sessionSchema = z.object({
  email: z.string().email(),
  displayName: z.string(),
  accessToken: z.string()
});

const chatRequestSchema = z.object({
  threadId: z.string(),
  threadTitle: z.string().default("New conversation"),
  bodyRedacted: z.string(),
  redactionMap: z.array(z.any()).default([]),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        mimeType: z.string(),
        kind: z.string(),
        sizeBytes: z.number().nonnegative().default(0),
        dataBase64: z.string().default("")
      })
    )
    .default([]),
  contextItems: z.array(contextItemSchema).default([]),
  hiddenHostPageContext: hiddenHostPageContextSchema.nullish(),
  memoryDigest: z.string().default(""),
  recentMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        body: z.string()
      })
    )
    .default([])
});

const finalizeSchema = z.object({
  threadId: z.string(),
  closeReason: z.enum(["manual-close", "idle-timeout", "browser-unload"]),
  session: sessionSchema.optional(),
  thread: threadSchema.optional()
});

const accessRequestSchema = z.object({
  email: z.string(),
  displayName: z.string().optional()
});

const listThreadsSchema = z.object({
  session: sessionSchema
});

const syncThreadsSchema = z.object({
  session: sessionSchema,
  threads: z.array(threadSchema)
});

export interface JsonResponse {
  status: number;
  body: unknown;
}

export function parseJsonPayload(rawPayload: unknown) {
  if (typeof rawPayload === "string") {
    return rawPayload.length > 0 ? JSON.parse(rawPayload) : {};
  }

  return rawPayload ?? {};
}

export function getHealthResponse(): JsonResponse {
  return {
    status: 200,
    body: {
      ok: true,
      service: "cyncly-advisor-api"
    }
  };
}

export async function handleEmailAccess(rawPayload: unknown): Promise<JsonResponse> {
  const payload = accessRequestSchema.parse(parseJsonPayload(rawPayload));
  const appServices = await getAppServices();
  const accessResult = await appServices.emailAccessService.requestAccess(payload.email, payload.displayName);

  if (!accessResult) {
    return {
      status: 403,
      body: {
        ok: false,
        message: "That email does not have access to Cyncly Advisor."
      }
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      user: accessResult
    }
  };
}

export async function handleChatSend(rawPayload: unknown): Promise<JsonResponse> {
  const payload = chatRequestSchema.parse(parseJsonPayload(rawPayload));
  const appServices = await getAppServices();
  const result = await appServices.orchestrationService.executeTurn({
    threadId: payload.threadId,
    threadTitle: payload.threadTitle,
    bodyRedacted: payload.bodyRedacted,
    attachments: payload.attachments,
    contextItems: payload.contextItems,
    hiddenHostPageContext: payload.hiddenHostPageContext ?? null,
    memoryDigest: payload.memoryDigest,
    recentMessages: payload.recentMessages
  });

  const responseBody: ChatTurnResponse = {
    ok: true,
    status: "completed",
    orchestration: result.decision,
    thinkingPlan: result.thinkingPlan,
    message: result.assistantMessage,
    sources: result.sources,
    warnings: result.warnings
  };

  return {
    status: 200,
    body: responseBody
  };
}

export async function handleThreadsList(rawPayload: unknown): Promise<JsonResponse> {
  const payload = listThreadsSchema.parse(parseJsonPayload(rawPayload));
  const appServices = await getAppServices();

  if (!appServices.emailAccessService.verifySession(payload.session)) {
    return invalidSessionResponse();
  }

  const threads = await appServices.persistenceService.listThreads(payload.session.email);

  return {
    status: 200,
    body: {
      ok: true,
      threads
    }
  };
}

export async function handleThreadsSync(rawPayload: unknown): Promise<JsonResponse> {
  const payload = syncThreadsSchema.parse(parseJsonPayload(rawPayload));
  const appServices = await getAppServices();

  if (!appServices.emailAccessService.verifySession(payload.session)) {
    return invalidSessionResponse();
  }

  for (const thread of payload.threads) {
    await appServices.persistenceService.saveThreadSnapshot({
      session: payload.session,
      thread: thread as ChatThread
    });
  }

  return {
    status: 200,
    body: {
      ok: true
    }
  };
}

export async function handleConversationFinalize(rawPayload: unknown): Promise<JsonResponse> {
  const payload = finalizeSchema.parse(parseJsonPayload(rawPayload));
  const appServices = await getAppServices();

  if (payload.session && !appServices.emailAccessService.verifySession(payload.session)) {
    return invalidSessionResponse();
  }

  await appServices.finalizationService.finalizeConversation({
    threadId: payload.threadId,
    closeReason: payload.closeReason,
    session: payload.session as EmailAccessSession | undefined,
    thread: payload.thread as ChatThread | undefined
  });

  return {
    status: 200,
    body: {
      ok: true
    }
  };
}

function invalidSessionResponse(): JsonResponse {
  return {
    status: 403,
    body: {
      ok: false,
      message: "Session is not valid."
    }
  };
}

type AppServices = Awaited<ReturnType<typeof loadAppServices>>;

let cachedAppServices: AppServices | null = null;

async function getAppServices() {
  if (cachedAppServices) {
    return cachedAppServices;
  }

  cachedAppServices = await loadAppServices();
  return cachedAppServices;
}

async function loadAppServices() {
  const { createAppServices } = await import("../composition/createAppServices.js");
  return createAppServices();
}
