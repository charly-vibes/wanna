// Purpose: need normalization adapter for the composition shell (wanna-15e)
// Responsibilities: map the shell's raw proposal input into the interaction-need layer's vocabulary and run the layer's public normalizer; surface the layer's typed refusal unchanged
// Rationale: [[composition.shell.need_normalized_before_evaluation]] — the shell evaluates only contexts whose normalized need validated through the interaction-need layer; a context the need layer cannot normalize surfaces as that layer's typed refusal, passed through the shell unchanged, before any evaluation occurs
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  EvidenceStrength,
  NeedProposal,
  NormalizedNeed,
} from "../../interaction-need";
import { createNeedNormalizer } from "../../interaction-need";
import type { NeedProposalInput } from "../types";
import { revisionToLayerString } from "./revision";

export type { NormalizedNeed };

export type NeedNormalization =
  | { readonly ok: true; readonly normalized: NormalizedNeed }
  | { readonly ok: false; readonly reason: string };

/** Map the shell proposal onto the need layer's proposal record. */
export function toNeedProposal(
  input: NeedProposalInput,
  revision: number,
): NeedProposal {
  return {
    kind: input.kind,
    target: input.target,
    taskRevision: revisionToLayerString(revision),
    proposalId: input.proposalId,
    evidenceRefs: [...input.evidenceRefs],
    evidenceStrength: input.evidenceStrength as EvidenceStrength,
  };
}

/**
 * Normalize through the interaction-need layer's public machine. Validation
 * failure and a non-immediate (unresolved) need both return the layer's own
 * reason verbatim — the shell never rewords or synthesizes a normalization
 * refusal, and never reaches policy eligibility or engine evaluation.
 */
export function normalizeNeedProposal(
  input: NeedProposalInput,
  revision: number,
): NeedNormalization {
  const normalizer = createNeedNormalizer(toNeedProposal(input, revision));
  const validated = normalizer.fire("validate_need");
  if (!validated.ok) {
    return { ok: false, reason: validated.reason ?? "need validation produced no reason" };
  }
  const normalizedTransition = normalizer.fire("normalize_need");
  if (!normalizedTransition.ok) {
    const unresolved = normalizer.unresolvedRecord;
    return {
      ok: false,
      reason: unresolved?.reason ?? normalizedTransition.reason ?? "need normalization produced no reason",
    };
  }
  const normalized = normalizer.normalized;
  return normalized !== null
    ? { ok: true, normalized }
    : { ok: false, reason: "need normalization produced no normalized record" };
}
