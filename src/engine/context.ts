// Purpose: context validation for the interaction engine
// Responsibilities: reject malformed contexts before policy evaluation
// Rationale: [[spec.context_schema_valid]] — the accept/reject guard
import type { ContextSnapshot } from "./types";

export function contextSchemaValid(ctx: ContextSnapshot): boolean {
  return (
    typeof ctx.taskId === "string" && ctx.taskId.trim() !== "" &&
    typeof ctx.taskRevision === "number" && Number.isFinite(ctx.taskRevision) &&
    typeof ctx.need === "string" && ctx.need.trim() !== "" &&
    typeof ctx.catalogVersion === "string" && ctx.catalogVersion.trim() !== "" &&
    typeof ctx.policyVersion === "string" && ctx.policyVersion.trim() !== ""
  );
}

/** Stable canonical key over the context — equal contexts produce equal keys. */
export function canonicalContextKey(ctx: ContextSnapshot): string {
  return [ctx.taskId, ctx.taskRevision, ctx.need, ctx.catalogVersion, ctx.policyVersion].join("\u0000");
}