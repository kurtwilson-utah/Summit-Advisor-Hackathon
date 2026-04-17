import type { ChatMessage, ChatThread, EmailAccessSession, ThreadAgentState } from "../../../shared/thread";
import { createSupabaseAdminClient } from "../../lib/supabaseAdmin";

const THREAD_TABLE = "advisor_threads";
const MESSAGE_TABLE = "advisor_messages";
const EXPORT_TABLE = "advisor_thread_exports";

interface AdvisorThreadRow {
  id: string;
  access_email: string;
  access_name: string;
  title: string;
  status_label: string;
  updated_at: string;
  summary: string;
  memory_digest: string;
  notion_status: string;
  agent_states: ThreadAgentState[] | null;
}

interface AdvisorMessageRow {
  id: string;
  thread_id: string;
  role: ChatMessage["role"];
  author_label: string;
  body_display: string;
  body_model: string | null;
  created_at: string;
  agent_key: ChatMessage["agentKey"] | null;
  attachments: ChatMessage["attachments"] | null;
  redaction: ChatMessage["redaction"] | null;
}

interface AdvisorExportRow {
  thread_id: string;
  status: "pending" | "sent" | "failed";
  close_reason: string | null;
  transcript_page_id: string | null;
  idea_page_ids: string[] | null;
  idea_count: number | null;
  last_error: string | null;
}

export interface ThreadContextSnapshot {
  memoryDigest: string;
  recentMessageCount: number;
}

export interface ConversationExportPayload {
  session: Pick<EmailAccessSession, "email" | "displayName">;
  thread: ChatThread;
  exportState: {
    status: "pending" | "sent" | "failed";
    closeReason: string | null;
    transcriptPageId: string | null;
    ideaPageIds: string[];
    ideaCount: number;
    lastError: string | null;
  };
}

export interface ConversationPersistenceAdapter {
  loadThreadContext(threadId: string): Promise<ThreadContextSnapshot>;
  listThreads(email: string): Promise<ChatThread[]>;
  saveThreadSnapshot(args: { session: EmailAccessSession; thread: ChatThread }): Promise<void>;
  queueConversationExport(args: { threadId: string; reason: string }): Promise<void>;
  loadConversationExportPayload(threadId: string): Promise<ConversationExportPayload | null>;
  markConversationExported(args: {
    threadId: string;
    transcriptPageId: string;
    ideaPageIds: string[];
    ideaCount: number;
  }): Promise<void>;
  markConversationExportFailed(args: { threadId: string; errorMessage: string }): Promise<void>;
}

export function createSupabasePersistenceAdapter(): ConversationPersistenceAdapter {
  const client = createSupabaseAdminClient();

  return {
    async loadThreadContext(threadId) {
      const [threadResult, countResult] = await Promise.all([
        client.from(THREAD_TABLE).select("memory_digest").eq("id", threadId).maybeSingle(),
        client.from(MESSAGE_TABLE).select("id", { count: "exact", head: true }).eq("thread_id", threadId)
      ]);

      if (threadResult.error) {
        throw threadResult.error;
      }

      if (countResult.error) {
        throw countResult.error;
      }

      return {
        memoryDigest: threadResult.data?.memory_digest ?? "New thread. No compressed memory yet.",
        recentMessageCount: countResult.count ?? 0
      };
    },
    async listThreads(email) {
      const normalizedEmail = normalizeEmail(email);
      const threadResult = await client
        .from(THREAD_TABLE)
        .select("id, access_email, access_name, title, status_label, updated_at, summary, memory_digest, notion_status, agent_states")
        .eq("access_email", normalizedEmail)
        .order("updated_at", { ascending: false });

      if (threadResult.error) {
        throw threadResult.error;
      }

      const threads = (threadResult.data ?? []) as AdvisorThreadRow[];

      if (threads.length === 0) {
        return [];
      }

      const messageResult = await client
        .from(MESSAGE_TABLE)
        .select("id, thread_id, role, author_label, body_display, body_model, created_at, agent_key, attachments, redaction")
        .in(
          "thread_id",
          threads.map((thread) => thread.id)
        )
        .order("created_at", { ascending: true });

      if (messageResult.error) {
        throw messageResult.error;
      }

      const messagesByThread = new Map<string, ChatMessage[]>();

      for (const row of (messageResult.data ?? []) as AdvisorMessageRow[]) {
        const currentMessages = messagesByThread.get(row.thread_id) ?? [];
        currentMessages.push({
          id: row.id,
          role: row.role,
          authorLabel: row.author_label,
          bodyDisplay: row.body_display,
          bodyModel: row.body_model ?? undefined,
          createdAt: row.created_at,
          agentKey: row.agent_key ?? undefined,
          attachments: row.attachments ?? undefined,
          redaction: row.redaction ?? undefined
        });
        messagesByThread.set(row.thread_id, currentMessages);
      }

      return threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        statusLabel: thread.status_label,
        updatedAt: thread.updated_at,
        summary: thread.summary,
        memoryDigest: thread.memory_digest,
        notionStatus: thread.notion_status,
        agentStates: thread.agent_states ?? [],
        messages: messagesByThread.get(thread.id) ?? []
      }));
    },
    async saveThreadSnapshot({ session, thread }) {
      const normalizedEmail = normalizeEmail(session.email);
      const threadUpsert = await client.from(THREAD_TABLE).upsert(
        {
          id: thread.id,
          access_email: normalizedEmail,
          access_name: session.displayName,
          title: thread.title,
          status_label: thread.statusLabel,
          updated_at: thread.updatedAt,
          summary: thread.summary,
          memory_digest: thread.memoryDigest,
          notion_status: thread.notionStatus,
          agent_states: thread.agentStates,
          last_message_at: thread.updatedAt
        },
        {
          onConflict: "id"
        }
      );

      if (threadUpsert.error) {
        throw threadUpsert.error;
      }

      const deleteResult = await client.from(MESSAGE_TABLE).delete().eq("thread_id", thread.id);

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      if (thread.messages.length === 0) {
        return;
      }

      for (let index = 0; index < thread.messages.length; index += 50) {
        const batch = thread.messages.slice(index, index + 50).map((message) => ({
          id: message.id,
          thread_id: thread.id,
          role: message.role,
          author_label: message.authorLabel,
          body_display: message.bodyDisplay,
          body_model: message.bodyModel ?? null,
          created_at: message.createdAt,
          agent_key: message.agentKey ?? null,
          attachments: message.attachments ?? [],
          redaction: message.redaction ?? null
        }));
        const insertResult = await client.from(MESSAGE_TABLE).insert(batch);

        if (insertResult.error) {
          throw insertResult.error;
        }
      }
    },
    async queueConversationExport({ threadId, reason }) {
      const now = new Date().toISOString();

      const [exportResult, threadResult] = await Promise.all([
        client.from(EXPORT_TABLE).upsert(
          {
            thread_id: threadId,
            status: "pending",
            close_reason: reason,
            last_error: null,
            updated_at: now
          },
          {
            onConflict: "thread_id"
          }
        ),
        client
          .from(THREAD_TABLE)
          .update({
            notion_status: "Finalize pending",
            conversation_closed_at: now,
            updated_at: now
          })
          .eq("id", threadId)
      ]);

      if (exportResult.error) {
        throw exportResult.error;
      }

      if (threadResult.error) {
        throw threadResult.error;
      }
    },
    async loadConversationExportPayload(threadId) {
      const [threadResult, messageResult, exportResult] = await Promise.all([
        client
          .from(THREAD_TABLE)
          .select("id, access_email, access_name, title, status_label, updated_at, summary, memory_digest, notion_status, agent_states")
          .eq("id", threadId)
          .maybeSingle(),
        client
          .from(MESSAGE_TABLE)
          .select("id, thread_id, role, author_label, body_display, body_model, created_at, agent_key, attachments, redaction")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
        client
          .from(EXPORT_TABLE)
          .select("thread_id, status, close_reason, transcript_page_id, idea_page_ids, idea_count, last_error")
          .eq("thread_id", threadId)
          .maybeSingle()
      ]);

      if (threadResult.error) {
        throw threadResult.error;
      }

      if (messageResult.error) {
        throw messageResult.error;
      }

      if (exportResult.error) {
        throw exportResult.error;
      }

      if (!threadResult.data) {
        return null;
      }

      const threadRow = threadResult.data as AdvisorThreadRow;
      const messages = ((messageResult.data ?? []) as AdvisorMessageRow[]).map((row) => ({
        id: row.id,
        role: row.role,
        authorLabel: row.author_label,
        bodyDisplay: row.body_display,
        bodyModel: row.body_model ?? undefined,
        createdAt: row.created_at,
        agentKey: row.agent_key ?? undefined,
        attachments: row.attachments ?? undefined,
        redaction: row.redaction ?? undefined
      }));
      const exportRow = exportResult.data as AdvisorExportRow | null;

      return {
        session: {
          email: threadRow.access_email,
          displayName: threadRow.access_name
        },
        thread: {
          id: threadRow.id,
          title: threadRow.title,
          statusLabel: threadRow.status_label,
          updatedAt: threadRow.updated_at,
          summary: threadRow.summary,
          memoryDigest: threadRow.memory_digest,
          notionStatus: threadRow.notion_status,
          agentStates: threadRow.agent_states ?? [],
          messages
        },
        exportState: {
          status: exportRow?.status ?? "pending",
          closeReason: exportRow?.close_reason ?? null,
          transcriptPageId: exportRow?.transcript_page_id ?? null,
          ideaPageIds: exportRow?.idea_page_ids ?? [],
          ideaCount: exportRow?.idea_count ?? 0,
          lastError: exportRow?.last_error ?? null
        }
      };
    },
    async markConversationExported({ threadId, transcriptPageId, ideaPageIds, ideaCount }) {
      const now = new Date().toISOString();
      const [exportResult, threadResult] = await Promise.all([
        client
          .from(EXPORT_TABLE)
          .update({
            status: "sent",
            transcript_page_id: transcriptPageId,
            idea_page_ids: ideaPageIds,
            idea_count: ideaCount,
            last_error: null,
            updated_at: now
          })
          .eq("thread_id", threadId),
        client
          .from(THREAD_TABLE)
          .update({
            notion_status: "Transcript synced",
            conversation_closed_at: now,
            updated_at: now
          })
          .eq("id", threadId)
      ]);

      if (exportResult.error) {
        throw exportResult.error;
      }

      if (threadResult.error) {
        throw threadResult.error;
      }
    },
    async markConversationExportFailed({ threadId, errorMessage }) {
      const now = new Date().toISOString();
      const [exportResult, threadResult] = await Promise.all([
        client.from(EXPORT_TABLE).upsert(
          {
            thread_id: threadId,
            status: "failed",
            last_error: errorMessage,
            updated_at: now
          },
          {
            onConflict: "thread_id"
          }
        ),
        client
          .from(THREAD_TABLE)
          .update({
            notion_status: "Finalization failed",
            updated_at: now
          })
          .eq("id", threadId)
      ]);

      if (exportResult.error) {
        throw exportResult.error;
      }

      if (threadResult.error) {
        throw threadResult.error;
      }
    }
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
