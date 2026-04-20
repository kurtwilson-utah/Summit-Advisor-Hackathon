import type { EmailAllowlistAdapter } from "../../providers/access/envAllowlistAdapter.js";
import type { SignedAccessSession } from "../../lib/accessSessionSigner.js";

export interface EmailAccessResult extends SignedAccessSession {}

export interface EmailAccessService {
  requestAccess(email: string, displayName?: string): Promise<EmailAccessResult | null>;
  verifySession(session: SignedAccessSession): boolean;
}

export function createEmailAccessService(dependencies: {
  allowlistAdapter: EmailAllowlistAdapter;
  sessionSigner: {
    sign(args: { email: string; displayName: string }): SignedAccessSession;
    verify(session: SignedAccessSession): boolean;
  };
}): EmailAccessService {
  return {
    async requestAccess(email, displayName) {
      const normalizedEmail = email.trim().toLowerCase();

      if (!isValidEmail(normalizedEmail)) {
        return null;
      }

      const isAllowed = await dependencies.allowlistAdapter.isAllowed(normalizedEmail);

      if (!isAllowed) {
        return null;
      }

      return dependencies.sessionSigner.sign({
        email: normalizedEmail,
        displayName: sanitizeDisplayName(displayName) || createDisplayName(normalizedEmail)
      });
    },
    verifySession(session) {
      return dependencies.sessionSigner.verify(session);
    }
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createDisplayName(email: string): string {
  const localPart = email.split("@")[0] ?? email;

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function sanitizeDisplayName(displayName?: string) {
  const trimmed = displayName?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "";
}
