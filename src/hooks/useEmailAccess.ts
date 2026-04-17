import { useState } from "react";
import type { EmailAccessSession } from "../lib/types";
import { createEmailAccessProvider } from "../services/access/emailAccessProvider";
import { createEmailSessionRepository } from "../services/access/emailSessionRepository";

const emailAccessProvider = createEmailAccessProvider();
const emailSessionRepository = createEmailSessionRepository();

export function useEmailAccess() {
  const [session, setSession] = useState<EmailAccessSession | null>(() => emailSessionRepository.load());
  const [emailDraft, setEmailDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitEmail() {
    const trimmedEmail = emailDraft.trim();

    if (!trimmedEmail) {
      setErrorMessage("Enter your email to continue.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const nextSession = await emailAccessProvider.requestAccess(trimmedEmail);
      emailSessionRepository.save(nextSession);
      setSession(nextSession);
      setEmailDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function signOut() {
    emailSessionRepository.clear();
    setSession(null);
    setErrorMessage(null);
  }

  return {
    emailDraft,
    errorMessage,
    isSubmitting,
    session,
    setEmailDraft,
    signOut,
    submitEmail
  };
}
