import type { ChatThread } from "../../lib/types";

export interface ThreadRepository {
  loadThreads(): ChatThread[] | null;
  saveThreads(threads: ChatThread[]): void;
}

const STORAGE_KEY = "cyncly-advisor/threads/v1";

export function createLocalThreadRepository(): ThreadRepository {
  return {
    loadThreads() {
      if (typeof window === "undefined") {
        return null;
      }

      const serialized = window.localStorage.getItem(STORAGE_KEY);

      if (!serialized) {
        return null;
      }

      try {
        const parsed = JSON.parse(serialized) as unknown;

        if (!Array.isArray(parsed) || parsed.length === 0) {
          return null;
        }

        return parsed as ChatThread[];
      } catch {
        return null;
      }
    },
    saveThreads(threads) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    }
  };
}
