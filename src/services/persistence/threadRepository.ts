import type { ChatThread } from "../../lib/types";
import { sortThreadsByRecentActivity } from "../../lib/chatEngine";

export interface ThreadRepository {
  loadThreads(email: string): ChatThread[] | null;
  saveThreads(email: string, threads: ChatThread[]): void;
  clearUnscopedLegacy(): void;
}

const STORAGE_PREFIX = "cyncly-advisor/threads/v1";
const LEGACY_STORAGE_KEY = STORAGE_PREFIX;

export function createLocalThreadRepository(): ThreadRepository {
  const keyFor = (email: string) => `${STORAGE_PREFIX}/${email.trim().toLowerCase()}`;

  return {
    loadThreads(email) {
      if (typeof window === "undefined" || !email) {
        return null;
      }

      const serialized = window.localStorage.getItem(keyFor(email));

      if (!serialized) {
        return null;
      }

      try {
        const parsed = JSON.parse(serialized) as unknown;

        if (!Array.isArray(parsed) || parsed.length === 0) {
          return null;
        }

        return sortThreadsByRecentActivity(parsed as ChatThread[]);
      } catch {
        return null;
      }
    },
    saveThreads(email, threads) {
      if (typeof window === "undefined" || !email) {
        return;
      }

      window.localStorage.setItem(keyFor(email), JSON.stringify(sortThreadsByRecentActivity(threads)));
    },
    clearUnscopedLegacy() {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  };
}
