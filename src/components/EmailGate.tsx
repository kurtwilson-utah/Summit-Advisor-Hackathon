import type { FormEvent } from "react";
import { Lock, Mail, Sparkles } from "lucide-react";

interface EmailGateProps {
  emailDraft: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onEmailDraftChange: (value: string) => void;
  onSubmit: () => void;
}

export function EmailGate({
  emailDraft,
  errorMessage,
  isSubmitting,
  onEmailDraftChange,
  onSubmit
}: EmailGateProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <main className="email-gate">
      <form className="email-gate-card" onSubmit={handleSubmit}>
        <div className="email-gate-badge">
          <Sparkles size={18} />
        </div>

        <div className="email-gate-copy">
          <p className="eyebrow">Private access</p>
          <h1>Cyncly Advisor</h1>
          <p>
            Enter your Cyncly email to continue. Access is validated on the server against a private allowlist.
          </p>
        </div>

        <label className="email-gate-field">
          <Mail size={16} />
          <input
            autoComplete="email"
            onChange={(event) => onEmailDraftChange(event.target.value)}
            placeholder="name@cyncly.com"
            type="email"
            value={emailDraft}
          />
        </label>

        {errorMessage ? (
          <p className="email-gate-error">
            <Lock size={14} />
            {errorMessage}
          </p>
        ) : null}

        <button className="primary-button email-gate-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Checking access..." : "Continue"}
        </button>
      </form>
    </main>
  );
}
