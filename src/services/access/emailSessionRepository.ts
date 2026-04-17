import type { EmailAccessSession } from "../../lib/types";

const STORAGE_KEY = "cyncly-advisor/email-session/v1";

export interface EmailSessionRepository {
  load(): EmailAccessSession | null;
  save(session: EmailAccessSession): void;
  clear(): void;
}

export function createEmailSessionRepository(): EmailSessionRepository {
  return {
    load() {
      if (typeof window === "undefined") {
        return null;
      }

      const serialized = window.localStorage.getItem(STORAGE_KEY);

      if (!serialized) {
        return null;
      }

      try {
        const parsed = JSON.parse(serialized) as Partial<EmailAccessSession>;

        if (!parsed?.email || !parsed.displayName || !parsed.accessToken) {
          return null;
        }

        return parsed as EmailAccessSession;
      } catch {
        return null;
      }
    },
    save(session) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    },
    clear() {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(STORAGE_KEY);
    }
  };
}
