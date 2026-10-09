// Purpose: policy eligibility adapter for the composition shell (wanna-15e)
// Responsibilities: map a normalized review need plus the consumer's pinned catalog into the interaction-policy layer's input vocabulary and run the layer's public evaluator; return the layer's result with recommendation order and exclusions intact
// Rationale: [[composition.shell.policy_eligibility_composed]] — the shell normalizes raw need proposals and runs the interaction-policy eligibility gates before engine evaluation, preserving recommendation order, exclusions and provenance. The machine input's policy pin is the composed policy implementation's own runtime identity; the decision's evaluation policy version is pinned separately from the consumer's immutable input ([[composition.shell.evaluation_versions_pinned]]).
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  NormalizedNeedRecord,
  PolicyCandidate,
  PolicyInput,
  PolicyResult,
  Recommendation,
} from "../../interaction-policy";
import { createPolicyMachine, MAX_RECOMMENDATIONS_CEILING, POLICY_VERSION } from "../../interaction-policy";
import type { NormalizedNeed } from "../../interaction-need";

/**
 * The runtime kind the trusted v0 review mapping selects
 * ([[composition.shell.review_mapping_explicit]]): a normalized
 * `review_artifact` need selects catalog kind `review`.
 */
export const REVIEW_RUNTIME_KIND = "review";

/** Evidence input naming the artifact revision's own evidence references. */
const ARTIFACT_REVISION_EVIDENCE = "artifact_revision_evidence";

/**
 * Evidence input naming independently verified truth. v0 evidence references
 * are never claims of independently verified truth (design.md, Provenance
 * row), so this input is never available in v0 and the verification-demanding
 * candidate stays hard-gate excluded.
 */
const INDEPENDENTLY_VERIFIED_REVISION = "independently_verified_revision";

export type PolicyEligibility =
  | { readonly ok: true; readonly result: PolicyResult }
  | { readonly ok: false; readonly reason: string };

/**
 * The shell's trusted v0 candidate supply for a review need: the artifact
 * review interaction on the need's target, plus the independently-verified
 * review alternative that v0 can never satisfy. Both are policy candidates —
 * the interaction-policy layer owns every eligibility decision.
 */
function trustedReviewCandidates(need: NormalizedNeed): readonly PolicyCandidate[] {
  const evidenceAvailable = need.evidenceRefs.length > 0;
  return [
    {
      id: `review:${need.target}@${need.taskRevision}`,
      kind: REVIEW_RUNTIME_KIND,
      requiredInputs: [ARTIFACT_REVISION_EVIDENCE],
      availableInputs: evidenceAvailable ? [ARTIFACT_REVISION_EVIDENCE] : [],
      requiredCapabilities: [],
      hostCapabilities: [],
      failedHardGates: [],
      score: 1,
    },
    {
      id: `verified-review:${need.target}@${need.taskRevision}`,
      kind: REVIEW_RUNTIME_KIND,
      requiredInputs: [INDEPENDENTLY_VERIFIED_REVISION],
      availableInputs: [],
      requiredCapabilities: [],
      hostCapabilities: [],
      failedHardGates: [],
      score: 0,
    },
  ];
}

function toNeedRecord(need: NormalizedNeed): NormalizedNeedRecord {
  return {
    kind: need.kind,
    target: need.target,
    taskRevision: need.taskRevision,
    proposalId: need.proposalId,
    evidenceRefs: [...need.evidenceRefs],
    taxonomyVersion: need.taxonomyVersion,
    normalizedBy: need.normalizedBy,
  };
}

/**
 * Run the interaction-policy layer's public evaluator over the trusted
 * candidate supply. The layer's result — recommendation order, scores,
 * exclusions with their reason codes — is returned untouched; the shell adds
 * no eligibility logic of its own.
 */
export function evaluateEligibility(
  need: NormalizedNeed,
  catalogVersion: string,
): PolicyEligibility {
  const input: PolicyInput = {
    need: toNeedRecord(need),
    policyVersion: POLICY_VERSION,
    catalog: {
      version: catalogVersion,
      supportedKinds: [REVIEW_RUNTIME_KIND],
      needKindMappings: { review_artifact: [REVIEW_RUNTIME_KIND] },
    },
    maxRecommendations: MAX_RECOMMENDATIONS_CEILING,
    candidates: trustedReviewCandidates(need),
    context: { taskRevision: need.taskRevision, userPreferences: [] },
  };
  const outcome = createPolicyMachine(input).evaluate();
  return outcome.ok
    ? { ok: true, result: outcome.result }
    : { ok: false, reason: outcome.reason };
}

export type { PolicyResult, Recommendation };
