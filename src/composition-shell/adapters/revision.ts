// Purpose: canonical revision conversion for the composition shell boundary (wanna-15e)
// Responsibilities: exact lossless conversion between the shell's public revision vocabulary and the string-based need layer, refusing noncanonical or unsafe values
// Rationale: [[composition.shell.review_mapping_explicit]] — public task and interaction revisions are nonnegative safe integers; need adapters emit canonical decimal strings; reverse conversion requires an exact canonical decimal round trip. Never silently parse a hash or truncate a number.
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type { NeedProposalInput } from "../types";

/** Canonical decimal string: "0" or a nonzero-leading digit run, no sign or fraction. */
const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)$/;

/**
 * Accepts a public revision in either shell form — a nonnegative safe integer
 * number or an exact canonical decimal string — and returns the numeric
 * revision, or `null` for a noncanonical/unsafe value.
 */
export function canonicalRevision(
  value: NeedProposalInput["taskRevision"],
): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    if (!CANONICAL_DECIMAL.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/** The need layer's task-revision form: the canonical decimal string. */
export function revisionToLayerString(revision: number): string {
  return String(revision);
}
