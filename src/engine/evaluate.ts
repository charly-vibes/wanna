// Purpose: deterministic policy evaluation for the interaction engine
// Responsibilities: pure evaluation — pinned versions, stable ordering, full provenance
// Rationale: [[spec.no_effects_in_core]] + [[spec.deterministic_decision]] + [[spec.retain_decision_provenance]]
import type { Candidate, ContextSnapshot, DecisionResult, EvaluationResult, Exclusion, Policy } from "./types";
import { contextSchemaValid } from "./context";

/**
 * Pure function: identical (context, policy) inputs yield deeply equal results.
 * Ordering: priority desc, then id asc — stable and total over the candidate set.
 */
export function evaluate(ctx: ContextSnapshot, policy: Policy): EvaluationResult {
  if (!contextSchemaValid(ctx)) {
    return { ok: false, reason: "context_schema_valid does not hold — malformed context rejected before evaluation" };
  }
  if (policy.version.trim() === "" || ctx.policyVersion.trim() === "" || ctx.catalogVersion.trim() === "") {
    return { ok: false, reason: "policy_catalog_versions_pinned does not hold — unpinned evaluation inputs" };
  }
  const ordered: readonly Candidate[] = [...policy.candidates].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const eligible: readonly Candidate[] = ordered.filter((c) => c.priority > 0);
  const exclusions: readonly Exclusion[] = ordered
    .filter((c) => c.priority <= 0)
    .map((c) => ({ id: c.id, reasonCode: "priority_not_positive" }));
  const result: DecisionResult = {
    taskId: ctx.taskId,
    taskRevision: ctx.taskRevision,
    need: ctx.need,
    catalogVersion: ctx.catalogVersion,
    policyVersion: policy.version,
    candidates: eligible,
    exclusions,
  };
  return { ok: true, value: result };
}