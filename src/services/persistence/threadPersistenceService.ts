import type { ChatThread, EmailAccessSession } from "../../lib/types";
import { createLocalThreadRepository, type ThreadRepository } from "./threadRepository";
import { createThreadSyncProvider, type ThreadSyncProvider } from "./threadSyncProvider";

export interface ThreadPersistenceService extends ThreadRepository {
  finalizeThread(args: {
    session: EmailAccessSession;
    thread: ChatThread;
    closeReason: "manual-close" | "idle-timeout" | "browser-unload";
    keepalive?: boolean;
  }): Promise<void>;
  loadRemoteThreads(session: EmailAccessSession): Promise<ChatThread[]>;
  syncThreads(session: EmailAccessSession, threads: ChatThread[]): Promise<void>;
}

export function createThreadPersistenceService(): ThreadPersistenceService {
  const localRepository = createLocalThreadRepository();
  const syncProvider = createThreadSyncProvider();

  return {
    ...localRepository,
    async finalizeThread(args) {
      await syncProvider.finalizeThread(args);
    },
    async loadRemoteThreads(session) {
      return syncProvider.loadRemoteThreads(session);
    },
    async syncThreads(session, threads) {
      await syncProvider.syncThreads(session, threads);
    }
  };
}
