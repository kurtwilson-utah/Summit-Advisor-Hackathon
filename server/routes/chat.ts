import { Router } from "express";
import { ZodError } from "zod";
import {
  getHealthResponse,
  handleChatSend,
  handleConversationFinalize,
  handleEmailAccess,
  handleThreadsList,
  handleThreadsSync,
  type JsonResponse
} from "../http/chatApi.js";

export const chatRouter = Router();

chatRouter.get("/health", async (_request, response) => {
  await respond(response, getHealthResponse());
});

chatRouter.post("/access/email", async (request, response) => {
  await respond(response, handleEmailAccess(request.body));
});

chatRouter.post("/chat/send", async (request, response) => {
  await respond(response, handleChatSend(request.body));
});

chatRouter.post("/threads/list", async (request, response) => {
  await respond(response, handleThreadsList(request.body));
});

chatRouter.post("/threads/sync", async (request, response) => {
  await respond(response, handleThreadsSync(request.body));
});

chatRouter.post("/conversations/finalize", async (request, response) => {
  await respond(response, handleConversationFinalize(request.body));
});

async function respond(
  response: { status: (code: number) => { json: (body: unknown) => void } },
  result: Promise<JsonResponse> | JsonResponse
) {
  try {
    const payload = await result;
    response.status(payload.status).json(payload.body);
  } catch (error) {
    if (error instanceof ZodError) {
      response.status(400).json({
        ok: false,
        message: "Invalid request payload.",
        issues: error.flatten()
      });
      return;
    }

    console.error("API route failed.", error);
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}
