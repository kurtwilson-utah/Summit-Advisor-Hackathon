import { Bot, BrainCircuit, Compass, ShieldCheck } from "lucide-react";
import type { AgentKey, ThreadAgentState } from "../lib/types";

const agentIcons: Record<AgentKey, typeof Bot> = {
  "summit-product-manager": Compass,
  "summit-knowledge-agent": BrainCircuit,
  "third-party-research-agent": Bot
};

interface AgentRailProps {
  agents: ThreadAgentState[];
}

export function AgentRail({ agents }: AgentRailProps) {
  return (
    <section className="agent-rail">
      <div className="section-heading">
        <span>Orchestration</span>
        <ShieldCheck size={15} />
      </div>

      <div className="agent-grid">
        {agents.map((agent) => {
          const Icon = agentIcons[agent.key];

          return (
            <article className={`agent-card agent-${agent.status}`} key={agent.key}>
              <div className="agent-card-top">
                <div className="agent-badge">
                  <Icon size={16} />
                </div>
                <span className="agent-status-pill">{agent.status}</span>
              </div>

              <h3>{agent.label}</h3>
              <p>{agent.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
