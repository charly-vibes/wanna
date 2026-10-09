// Purpose: evaluateNeed command composition for the composition shell (wanna-15e)
// Responsibilities: run the documented pipeline — review-only kind mapping, canonical revision conversion, need-layer normalization, authoritative revision conflict check, policy eligibility gates, engine evaluation — and map layer outcomes back into the shell's typed decision outcomes
// Rationale: [[composition.shell.need_normalized_before_evaluation]] + [[composition.shell.policy_eligibility_composed]] + [[composition.shell.evaluation_versions_pinned]] + [[composition.shell.review_mapping_explicit]]. Evaluation alone mutates no aggregate state (design.md: "Evaluation alone does not mutate the aggregate"); the evaluated decision is retained in shell-local memory for wanna-8k6's compare-and-commit path only.
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  DecisionExclusion,
  DecisionProvenance,
  DecisionRecommendation,
  EvaluateNeedOutcome,
  NeedProposalInput,
  ReviewCatalog,
  ReviewPolicy,
  SessionTaskKey,
} from "./types";
import { COMPOSITION_SHELL_VERSION } from "./types";
import type { ShellState } from "./session";
import { canonicalRevision } from "./adapters/revision";
import { normalizeNeedProposal } from "./adapters/need";
import { evaluateEligibility } from "./adapters/policy";
import { evaluateEngineDecision } from "./adapters/engine";
import type { NormalizedNeed } from "./adapters/need";
import type { PolicyResult, Recommendation } from "./adapters/policy";
import type { DecisionResult } from "./adapters/engine";

/** Immutable identity the shell was opened with: trusted key plus evaluation pins. */
export interface ShellPins {
  readonly key: SessionTaskKey;
  readonly policy: ReviewPolicy;
  readonly catalog: ReviewCatalog;
}

/**
 * The shell-side evaluated decision retained for wanna-8k6's commit path.
 * Held in shell-local memory only — never authoritative aggregate state.
 */
export interface EvaluatedDecision {
  readonly id: string;
  readonly taskRevision: number;
  readonly provenance: DecisionProvenance;
  readonly recommendations: readonly DecisionRecommendation[];
}

/** The only need kind the v0 shell maps to a runtime interaction. */
const REVIEW_NEED_KIND = "review_artifact";

/** Deterministic decision identity within the port's deduplication scope. */
function decisionId(key: SessionTaskKey, revision: number, proposalId: string): string {
  return `${key.taskId}:review-artifact:${revision}:${proposalId}`;
}

function toExclusionViews(
  exclusions: readonly { readonly id: string; readonly reasonCode: string }[],
): readonly DecisionExclusion[] {
  return exclusions.map((exclusion) => ({
    id: exclusion.id,
    reasonCode: exclusion.reasonCode,
  }));
}

function toRecommendationViews(
  recommendations: readonly Recommendation[],
): readonly DecisionRecommendation[] {
  return recommendations.map((recommendation, index) => ({
    id: recommendation.id,
    kind: recommendation.kind,
    policyScore: recommendation.score,
    enginePriority: recommendations.length - index,
  }));
}

type BoundaryCheck =
  | { readonly ok: true; readonly revision: number }
  | { readonly ok: false; readonly outcome: EvaluateNeedOutcome };

/**
 * Review-only kind mapping and canonical revision conversion
 * ([[composition.shell.review_mapping_explicit]]) — typed refusals before any
 * layer runs, never a heuristic mapping or a parsed revision.
 */
function checkBoundary(input: NeedProposalInput): BoundaryCheck {
  if (input.kind !== REVIEW_NEED_KIND) {
    return { ok: false, outcome: { kind: "unsupported_kind", requestedKind: input.kind } };
  }
  const revision = canonicalRevision(input.taskRevision);
  if (revision === null) {
    return {
      ok: false,
      outcome: {
        kind: "refused",
        reason: `taskRevision ${String(input.taskRevision)} is not a canonical nonnegative safe integer revision`,
      },
    };
  }
  return { ok: true, revision };
}

/**
 * Need-layer normalization, then the authoritative-revision conflict check
 * — both strictly before any eligibility or engine contact.
 */
function normalizeAndCheckState(
  state: ShellState,
  input: NeedProposalInput,
  revision: number,
): { ok: true; need: NormalizedNeed } | { ok: false; outcome: EvaluateNeedOutcome } {
  const normalization = normalizeNeedProposal(input, revision);
  if (!normalization.ok) {
    return { ok: false, outcome: { kind: "refused", reason: normalization.reason } };
  }
  if (state.taskRevision !== revision) {
    return {
      ok: false,
      outcome: {
        kind: "refused",
        reason: `need proposal revision ${revision} conflicts with the authoritative artifact revision ${state.taskRevision}`,
      },
    };
  }
  return { ok: true, need: normalization.normalized };
}

/**
 * Policy eligibility gates, then engine evaluation over the eligible
 * recommendations only — excluded candidates are never supplied to the
 * engine and cannot reappear.
 */
function evaluateThroughLayers(
  pins: ShellPins,
  need: NormalizedNeed,
  revision: number,
):
  | { ok: true; policyResult: PolicyResult; engineDecision: DecisionResult }
  | { ok: false; outcome: EvaluateNeedOutcome } {
  const eligibility = evaluateEligibility(need, pins.catalog.catalogVersion);
  if (!eligibility.ok) return { ok: false, outcome: { kind: "refused", reason: eligibility.reason } };
  const policyResult = eligibility.result;
  if (policyResult.outcome === "no_candidate") {
    return {
      ok: false,
      outcome: {
        kind: "no_candidate",
        exclusions: toExclusionViews(policyResult.exclusions),
      },
    };
  }
  const engine = evaluateEngineDecision(
    pins.key,
    revision,
    need.kind,
    pins.catalog.catalogVersion,
    pins.policy.policyVersion,
    policyResult.recommendations,
  );
  if (!engine.ok) return { ok: false, outcome: { kind: "refused", reason: engine.reason } };
  return { ok: true, policyResult, engineDecision: engine.decision };
}

/**
 * Decision result construction: provenance retains proposal/evidence identity
 * and the pinned evaluation versions
 * ([[composition.shell.evaluation_versions_pinned]]).
 */
function buildDecision(
  pins: ShellPins,
  need: NormalizedNeed,
  revision: number,
  policyResult: PolicyResult,
): EvaluatedDecision {
  const provenance: DecisionProvenance = {
    proposalId: need.proposalId,
    evidenceRefs: [...need.evidenceRefs],
    exclusions: toExclusionViews(policyResult.exclusions),
    normalizerIdentity: need.normalizedBy,
    policyVersion: pins.policy.policyVersion,
    catalogVersion: pins.catalog.catalogVersion,
    taxonomyVersion: need.taxonomyVersion,
    shellVersion: COMPOSITION_SHELL_VERSION,
  };
  return {
    id: decisionId(pins.key, revision, need.proposalId),
    taskRevision: revision,
    provenance,
    recommendations: toRecommendationViews(policyResult.recommendations),
  };
}

/**
 * Evaluate a raw need proposal through the composed layers. Every refusal
 * branch returns before engine evaluation and mutates nothing.
 */
export async function evaluateNeedCommand(
  state: ShellState,
  pins: ShellPins,
  input: NeedProposalInput,
): Promise<EvaluateNeedOutcome> {
  const boundary = checkBoundary(input);
  if (!boundary.ok) return boundary.outcome;

  // Normalization before any evaluation ([[composition.shell.need_normalized_before_evaluation]]):
  // the need layer's typed refusal passes through the shell unchanged.
  const checked = normalizeAndCheckState(state, input, boundary.revision);
  if (!checked.ok) return checked.outcome;

  // Policy eligibility gates run before engine evaluation
  // ([[composition.shell.policy_eligibility_composed]]); zero eligible
  // candidates returns no_candidate with the policy's exclusions and creates
  // no interaction.
  const layers = evaluateThroughLayers(pins, checked.need, boundary.revision);
  if (!layers.ok) return layers.outcome;

  return { kind: "decided", ...buildDecision(pins, checked.need, boundary.revision, layers.policyResult) };
}
