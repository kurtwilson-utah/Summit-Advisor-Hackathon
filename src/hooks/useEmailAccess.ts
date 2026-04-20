import { useEffect, useState } from "react";
import type { EmailAccessSession } from "../lib/types";
import { createEmailAccessProvider } from "../services/access/emailAccessProvider";
import { createEmailSessionRepository } from "../services/access/emailSessionRepository";

const emailAccessProvider = createEmailAccessProvider();
const emailSessionRepository = createEmailSessionRepository();

export function useEmailAccess(args?: {
  isEmbeddedMode?: boolean;
  embeddedBootstrapUser?: {
    name: string;
    email: string;
  } | null;
}) {
  const [session, setSession] = useState<EmailAccessSession | null>(() =>
    args?.isEmbeddedMode ? null : emailSessionRepository.load()
  );
  const [emailDraft, setEmailDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!args?.isEmbeddedMode || !args.embeddedBootstrapUser?.email) {
      return;
    }

    const normalizedEmail = args.embeddedBootstrapUser.email.trim().toLowerCase();

    if (session?.email === normalizedEmail) {
      return;
    }

    let cancelled = false;

    setIsSubmitting(true);
    setErrorMessage(null);

    void emailAccessProvider
      .requestAccess(normalizedEmail, args.embeddedBootstrapUser.name)
      .then((nextSession) => {
        if (cancelled) {
          return;
        }

        emailSessionRepository.save(nextSession);
        setSession(nextSession);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Unable to connect embedded session.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsSubmitting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [args?.embeddedBootstrapUser?.email, args?.embeddedBootstrapUser?.name, args?.isEmbeddedMode, session?.email]);

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
    if (args?.isEmbeddedMode) {
      return;
    }

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
