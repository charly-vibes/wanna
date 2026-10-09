// Purpose: engine evaluation adapter for the composition shell (wanna-15e)
// Responsibilities: map the policy layer's ranked recommendations into the interaction engine's context/policy vocabulary and run the engine's public evaluator
// Rationale: design.md "Policy to engine" — run the public policy evaluator first, then supply engine candidates in recommendation order using positive descending ordinal priorities; engine priority is an adapter rank, not a policy score. Excluded candidates are never supplied to the engine, so they cannot reappear.
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  ContextSnapshot,
  DecisionResult,
  Policy as EnginePolicy,
} from "../../engine";
import { evaluate } from "../../engine";
import type { Recommendation } from "../../interaction-policy";
import type { SessionTaskKey } from "../types";

export type { DecisionResult };

export type EngineEvaluation =
  | { readonly ok: true; readonly decision: DecisionResult }
  | { readonly ok: false; readonly reason: string };

/**
 * Evaluate the eligible candidates through the interaction engine. Policy
 * recommendation order is preserved by construction: recommendation i receives
 * the positive descending ordinal priority `count - i`, so the engine's own
 * priority-desc/id-asc ordering reproduces the policy order. Policy scores and
 * exclusion reason codes stay in the shell decision — the engine never sees an
 * excluded candidate.
 */
export function evaluateEngineDecision(
  key: SessionTaskKey,
  taskRevision: number,
  need: string,
  catalogVersion: string,
  policyVersion: string,
  recommendations: readonly Recommendation[],
): EngineEvaluation {
  const candidates = recommendations.map((recommendation, index) => ({
    id: recommendation.id,
    priority: recommendations.length - index,
  }));
  const context: ContextSnapshot = {
    taskId: key.taskId,
    taskRevision,
    need,
    catalogVersion,
    policyVersion,
  };
  const policy: EnginePolicy = { version: policyVersion, candidates };
  const result = evaluate(context, policy);
  return result.ok
    ? { ok: true, decision: result.value }
    : { ok: false, reason: result.reason };
}
