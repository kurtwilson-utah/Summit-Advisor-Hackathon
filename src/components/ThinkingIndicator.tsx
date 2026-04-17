import { BrainCircuit, Compass, Search, Sparkles } from "lucide-react";
import type { AgentKey, ThinkingStepDefinition } from "../lib/types";

const stepIcons: Record<AgentKey, typeof Sparkles> = {
  "summit-product-manager": Compass,
  "summit-knowledge-agent": BrainCircuit,
  "third-party-research-agent": Search
};

interface ThinkingIndicatorProps {
  step: ThinkingStepDefinition;
}

export function ThinkingIndicator({ step }: ThinkingIndicatorProps) {
  const Icon = stepIcons[step.agentKey];

  return (
    <article className="thinking-indicator" aria-live="polite" aria-atomic="true">
      <div className="message-avatar" aria-hidden="true">
        <Sparkles size={16} />
      </div>

      <div className="thinking-bubble">
        <div className="thinking-meta">
          <span className="thinking-agent-pill">
            <Icon size={14} />
            Working
          </span>
        </div>

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
