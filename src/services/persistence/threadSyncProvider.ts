import type { ChatThread, EmailAccessSession } from "../../lib/types";
import { filterPersistableThreads } from "../../lib/chatEngine";
import { postJson } from "../api/apiClient";

export interface ThreadSyncProvider {
  loadRemoteThreads(session: EmailAccessSession): Promise<ChatThread[]>;
  syncThreads(session: EmailAccessSession, threads: ChatThread[]): Promise<void>;
  finalizeThread(args: {
    session: EmailAccessSession;
    thread: ChatThread;
    closeReason: "manual-close" | "idle-timeout" | "browser-unload";
    keepalive?: boolean;
  }): Promise<void>;
}

export function createThreadSyncProvider(): ThreadSyncProvider {
  return {
    async loadRemoteThreads(session) {
      const payload = await postJson<{ ok: true; threads: ChatThread[] } | { ok?: false; message?: string }>(
        "/api/threads/list",
        { session }
      );

      if (!("ok" in payload) || !payload.ok) {
        throw new Error("message" in payload ? payload.message ?? "Unable to load threads." : "Unable to load threads.");
      }

      return payload.threads;
    },
    async syncThreads(session, threads) {
      const persistableThreads = filterPersistableThreads(threads);
      await postJson<{ ok: true }>("/api/threads/sync", {
        session,
        threads: persistableThreads
      });
    },
    async finalizeThread({ session, thread, closeReason, keepalive = false }) {
      await postJson<{ ok: true }>(
        "/api/conversations/finalize",
        {
          threadId: thread.id,
          closeReason,
          session,
          thread: keepalive ? undefined : thread
        },
        { keepalive }
      );
    }
  };
}
