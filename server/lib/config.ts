import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.string().default("8787"),
  ACCESS_ALLOWED_EMAILS: z.string().default(""),
  ACCESS_GATE_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-20250514"),
  NOTION_TOKEN: z.string().optional(),
  NOTION_CHAT_LOG_DATABASE_ID: z.string().optional(),
  NOTION_IDEA_CAPTURE_DATABASE_ID: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("rag-private"),
  SUPABASE_CHAT_ATTACHMENTS_BUCKET: z.string().default("chat-attachments"),
  AGENT_PRIMARY_PROMPT_PATH: z.string().default("prompts/summit-product-manager.md"),
  AGENT_KNOWLEDGE_PROMPT_PATH: z.string().default("prompts/summit-knowledge-agent.md"),
  AGENT_RESEARCH_PROMPT_PATH: z.string().default("prompts/third-party-research-agent.md")
});

export const env = envSchema.parse(process.env);
