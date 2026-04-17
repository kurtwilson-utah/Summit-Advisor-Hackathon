import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { AgentKey } from "../../../shared/chat.js";
import { env } from "../../lib/config.js";

const promptPaths: Record<AgentKey, string> = {
  "summit-product-manager": env.AGENT_PRIMARY_PROMPT_PATH,
  "summit-knowledge-agent": env.AGENT_KNOWLEDGE_PROMPT_PATH,
  "third-party-research-agent": env.AGENT_RESEARCH_PROMPT_PATH
};

export interface ClaudeCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  images?: Array<{
    base64Data: string;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }>;
}

export interface ClaudeProviderAdapter {
  loadPrompt(agentKey: AgentKey): Promise<string>;
  complete(request: ClaudeCompletionRequest): Promise<string>;
}

export function createClaudeProviderAdapter(): ClaudeProviderAdapter {
  const client = env.ANTHROPIC_API_KEY
    ? new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY
      })
    : null;

  return {
    async loadPrompt(agentKey) {
      const promptPath = promptPaths[agentKey];
      const resolvedPath = isAbsolute(promptPath) ? promptPath : resolve(process.cwd(), promptPath);

      return readFile(resolvedPath, "utf8");
    },
    async complete({ systemPrompt, userPrompt, maxTokens, temperature = 0.2, images = [] }) {
      if (!client) {
        return [
          "Claude is not configured yet.",
          "Set ANTHROPIC_API_KEY on the server to enable live model responses."
        ].join("\n");
      }

      const modelCandidates = Array.from(
        new Set([env.CLAUDE_MODEL, "claude-sonnet-4-20250514", "claude-3-7-sonnet-20250219"])
      );
      let lastError: unknown;

      for (const model of modelCandidates) {
        try {
          const messageContent =
            images.length > 0
              ? [
                  ...images.map((image) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: image.mediaType,
                      data: image.base64Data
                    }
                  })),
                  {
                    type: "text" as const,
                    text: userPrompt
                  }
                ]
              : userPrompt;

          const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: messageContent
              }
            ]
          });

          return response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text.trim())
            .filter(Boolean)
            .join("\n\n");
        } catch (error) {
          lastError = error;

          if (!isModelNotFoundError(error)) {
            throw error;
          }
        }
      }

      throw lastError ?? new Error("No Claude model candidate could be resolved.");
    }
  };
}

function isModelNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 404
  );
}
