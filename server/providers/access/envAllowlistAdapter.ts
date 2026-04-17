export interface EmailAllowlistAdapter {
  isAllowed(email: string): Promise<boolean>;
}

export function createEnvAllowlistAdapter(allowedEmails: string[]): EmailAllowlistAdapter {
  const normalizedSet = new Set(
    allowedEmails.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0)
  );

  return {
    async isAllowed(email) {
      return normalizedSet.has(email.trim().toLowerCase());
    }
  };
}
