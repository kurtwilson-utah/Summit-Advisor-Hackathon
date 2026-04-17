import { ZodError } from "zod";
import type { JsonResponse } from "../server/http/chatApi.js";

interface ApiRequest {
  body?: unknown;
  method?: string;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array>;
}

interface ApiResponse {
  setHeader(name: string, value: string): unknown;
  status(code: number): ApiResponse;
  json(payload: unknown): void;
}

type JsonHandler = (payload: unknown) => Promise<JsonResponse> | JsonResponse;
type NoPayloadHandler = () => Promise<JsonResponse> | JsonResponse;

export function createGetRoute(handler: NoPayloadHandler) {
  return async function route(request: ApiRequest, response: ApiResponse) {
    if (request.method && request.method !== "GET") {
      writeMethodNotAllowed(response, "GET");
      return;
    }

    await respond(response, handler());
  };
}

export function createPostRoute(handler: JsonHandler) {
  return async function route(request: ApiRequest, response: ApiResponse) {
    if (request.method && request.method !== "POST") {
      writeMethodNotAllowed(response, "POST");
      return;
    }

    const payload = await readRequestPayload(request);
    await respond(response, handler(payload));
  };
}

async function readRequestPayload(request: ApiRequest): Promise<unknown> {
  if (request.body !== undefined) {
    return request.body;
  }

  if (typeof request[Symbol.asyncIterator] !== "function") {
    return {};
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  return rawBody.length > 0 ? rawBody : {};
}

async function respond(response: ApiResponse, result: Promise<JsonResponse> | JsonResponse) {
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

    console.error("Vercel function failed.", error);
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
}

function writeMethodNotAllowed(response: ApiResponse, allowedMethod: string) {
  response.setHeader("Allow", allowedMethod);
  response.status(405).json({
    ok: false,
    message: `Method not allowed. Use ${allowedMethod}.`
  });
}
