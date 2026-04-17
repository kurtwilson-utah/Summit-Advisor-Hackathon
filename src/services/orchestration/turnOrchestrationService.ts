import type { OrchestrationDecision, ThinkingStepDefinition } from "../../../shared/chat";
import { getAgentLabel } from "../../lib/chatEngine";
import type { DraftAttachment, ThreadAgentState } from "../../lib/types";

export interface PlannedTurn {
  decision: OrchestrationDecision;
  agentStates: ThreadAgentState[];
  thinkingPlan: ThinkingStepDefinition[];
}

export interface TurnOrchestrationService {
  planTurn(input: string, attachments: DraftAttachment[]): PlannedTurn;
  finalizeAgentStates(agentStates: ThreadAgentState[]): ThreadAgentState[];
}

export function createTurnOrchestrationService(): TurnOrchestrationService {
  return {
    planTurn(input, attachments) {
      const wantsKnowledge = /\b(product|summit|roadmap|feature|pricing|workflow|implementation)\b/i.test(
        input
      );
      const wantsResearch = /\b(compare|research|market|competitor|benchmark|third-party|outside)\b/i.test(
        input
      );
      const hasArtifacts = attachments.length > 0;
      const delegatedAgents = [
        ...(wantsKnowledge || hasArtifacts ? (["summit-knowledge-agent"] as const) : []),
        ...(wantsResearch ? (["third-party-research-agent"] as const) : [])
      ];

      const decision: OrchestrationDecision = {
        primaryAgent: "summit-product-manager",
        delegatedAgents: [...delegatedAgents],
        rationale:
          delegatedAgents.length > 0
            ? "The product manager should synthesize specialist inputs before answering."
            : "The product manager can answer directly for this turn."
      };

      return {
        decision,
        agentStates: [
          {
            key: "summit-product-manager",
            label: getAgentLabel("summit-product-manager"),
            status: "working",
            detail: "Considering the request and deciding how to route the turn."
          },
          {
            key: "summit-knowledge-agent",
            label: getAgentLabel("summit-knowledge-agent"),
            status: wantsKnowledge || hasArtifacts ? "working" : "ready",
            detail:
              wantsKnowledge || hasArtifacts
                ? "Investigating Summit capabilities and reviewing internal context."
                : "Standing by for Summit-specific questions."
          },
          {
            key: "third-party-research-agent",
            label: getAgentLabel("third-party-research-agent"),
            status: wantsResearch ? "working" : "ready",
            detail: wantsResearch
              ? "Researching external references and third-party context."
              : "Standing by for research-oriented prompts."
          }
        ],
        thinkingPlan: [
          {
            key: "considering",
            label: "Considering your question...",
            agentKey: "summit-product-manager",
            durationMs: 650
          },
          ...(wantsKnowledge || hasArtifacts
            ? [
                {
                  key: "knowledge",
                  label: "Investigating Summit's capabilities...",
                  agentKey: "summit-knowledge-agent",
                  durationMs: 900
                } satisfies ThinkingStepDefinition
              ]
            : []),
          ...(wantsResearch
            ? [
                {
                  key: "research",
                  label: "Researching...",
                  agentKey: "third-party-research-agent",
                  durationMs: 900
                } satisfies ThinkingStepDefinition
              ]
            : []),
          {
            key: "drafting",
            label: "Drafting response...",
            agentKey: "summit-product-manager",
            durationMs: 700
          }
        ]
      };
    },
    finalizeAgentStates(agentStates) {
      return agentStates.map((agent) => ({
        ...agent,
        status: agent.key === "summit-product-manager" ? "ready" : "idle",
        detail:
          agent.key === "summit-product-manager"
            ? "Turn completed and ready for the next request."
            : "No active turn."
      }));
    }
  };
}
