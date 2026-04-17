import { appConfig } from "../../config/appConfig";

interface ErrorPayload {
  ok?: false;
  message?: string;
}

export async function postJson<TResponse>(path: string, body: unknown, options?: { keepalive?: boolean }) {
  const url = `${appConfig.apiBaseUrl}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      keepalive: options?.keepalive
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(url, error));
  }

  const payload = await parseJsonResponse<TResponse | ErrorPayload>(response);

  if (!response.ok) {
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
      throw new Error(payload.message);
    }

    throw new Error(`Request to ${url} failed with status ${response.status}.`);
  }

  return payload as TResponse;
}

async function parseJsonResponse<TPayload>(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null as TPayload;
  }

  try {
    return JSON.parse(rawBody) as TPayload;
  } catch {
    throw new Error(buildNonJsonResponseMessage(response, rawBody));
  }
}

function buildNetworkErrorMessage(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const isFetchConnectivityIssue =
    message.includes("Failed to fetch") ||
    message.includes("Load failed") ||
    message.includes("NetworkError");

  if (!isFetchConnectivityIssue) {
    return message || `Unable to reach ${url}.`;
  }

  if (!appConfig.apiBaseUrl) {
    return [
      "Cannot reach the local API.",
      "Run `npm run server:dev` for the backend on port 8787 and `npm run dev` for the frontend on port 5173.",
      "Open the app from `http://localhost:5173`.",
      "If you launched `npm run preview`, that mode does not proxy `/api`; use `npm run dev` instead."
    ].join(" ");
  }

  return `Cannot reach the API at ${appConfig.apiBaseUrl}.`;
}

function buildNonJsonResponseMessage(response: Response, rawBody: string) {
  const normalizedBody = rawBody.replace(/\s+/g, " ").trim();
  const bodySnippet = normalizedBody.slice(0, 180);

  if (bodySnippet.includes("FUNCTION_INVOCATION_FAILED")) {
    return [
      `The deployed API at ${response.url} crashed before it could return JSON.`,
      "Vercel reported FUNCTION_INVOCATION_FAILED.",
      "Check the function logs and verify the latest deployment finished successfully."
    ].join(" ");
  }

  const detail = bodySnippet ? ` Raw response: ${bodySnippet}` : "";
  return `API response from ${response.url} was not valid JSON.${detail}`;
}
