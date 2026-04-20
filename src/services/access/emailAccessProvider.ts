import type { EmailAccessSession } from "../../lib/types";
import { postJson } from "../api/apiClient";

export interface EmailAccessProvider {
  requestAccess(email: string, displayName?: string): Promise<EmailAccessSession>;
}

export function createEmailAccessProvider(): EmailAccessProvider {
  return {
    async requestAccess(email, displayName) {
      const payload = await postJson<
        | { ok: true; user: EmailAccessSession }
        | { ok: false; message?: string }
      >("/api/access/email", { email, displayName });

      if (!payload.ok) {
        throw new Error(payload.message ?? "Unable to sign in.");
      }

      return payload.user;
    }
  };
}
