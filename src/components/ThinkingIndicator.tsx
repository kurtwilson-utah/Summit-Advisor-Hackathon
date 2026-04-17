import { Sparkles } from "lucide-react";
import type { ThinkingStepDefinition } from "../lib/types";

interface ThinkingIndicatorProps {
  step: ThinkingStepDefinition;
}

export function ThinkingIndicator({ step }: ThinkingIndicatorProps) {
  return (
    <article className="thinking-indicator" aria-live="polite" aria-atomic="true">
      <div className="message-avatar" aria-hidden="true">
        <Sparkles size={16} />
      </div>

      <div className="thinking-bubble">
        <p>{step.label}</p>

        <div className="thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}
