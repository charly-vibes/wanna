// Purpose: evaluation composition contract for the composition shell (wanna-15e)
// Responsibilities: normalization-before-evaluation ordering, canonical revision round trips, hard-gate exclusion and empty-eligibility semantics, and decision provenance version pinning — exercised only through the shell's evaluateNeed method
// Rationale: openspec/changes/add-composition-shell/specs/composition-shell/spec.md scenarios un-normalized-need-refused-before-evaluation, decision-result-carries-pinned-versions, excluded-or-empty-candidates and unsupported-boundary-representation; commit/submit semantics stay with wanna-8k6
import { describe, expect, it } from "vitest";
import * as shellApi from "../../src/composition-shell";
import type {
  EvaluateNeedOutcome,
  NeedProposalInput,
  ReviewSessionShell,
} from "../../src/composition-shell";
import { COMPOSITION_SHELL_VERSION } from "../../src/composition-shell";
// Layer public barrels — the shell composes these; the contract proves the
// composed reasons and identities come from the layers, not shell constants.
import {
  createNeedNormalizer,
  NORMALIZER_VERSION,
  TAXONOMY_VERSION,
} from "../../src/interaction-need";
import type { NeedProposal } from "../../src/interaction-need";
import { POLICY_VERSION as RUNTIME_POLICY_CONSTANT, REASON_CODES } from "../../src/interaction-policy";
import { FakeReviewStore, KEY } from "./consumer-support";

/** A valid review_artifact proposal at revision 7 with evidence present. */
function proposalInput(
  overrides: Partial<NeedProposalInput> = {},
): NeedProposalInput {
  return {
    kind: "review_artifact",
    target: "artifact-1",
    taskRevision: 7,
    proposalId: "proposal-7",
    evidenceRefs: ["artifact-1/revisions/7"],
    evidenceStrength: "sufficient",
    ...overrides,
  };
}

/**
 * Seed the authoritative artifact revision directly through the declared
 * port's conditional commit (the only mutation route), then open a ready shell.
 */
async function shellAtTaskRevision(
  store: FakeReviewStore,
  revision: number,
  policyVersion = "policy-1",
  catalogVersion = "catalog-1",
): Promise<ReviewSessionShell> {
  const port = store.port(KEY);
  const commit = await port.compareAndCommit(KEY, null, {
    operationId: `seed-revision-${revision}`,
    expectedTaskRevision: null,
    expectedInteractionRevision: null,
    stateChanges: { taskRevision: revision },
    replayAdditions: [],
  });
  if (commit.kind !== "applied")
    throw new Error(`setup: expected applied seed, got ${commit.kind}`);
  const opened = await shellApi.openReviewSession({
    key: KEY,
    policy: { policyVersion },
    catalog: { catalogVersion },
    port: store.port(KEY),
  });
  if (opened.kind !== "ready")
    throw new Error(`setup: expected ready open, got ${opened.kind}`);
  return opened.shell;
}

function assertRefused(
  outcome: EvaluateNeedOutcome,
  label: string,
): string {
  if (outcome.kind !== "refused")
    throw new Error(`${label}: expected refused, got ${outcome.kind}`);
  expect(outcome.reason.length, label).toBeGreaterThan(0);
  return outcome.reason;
}

/**
 * Run the identical proposal through the need layer's public normalizer so the
 * contract can prove the shell passes the layer's typed refusal through
 * unchanged instead of synthesizing its own.
 */
function needLayerReason(proposal: NeedProposalInput): string {
  const normalizer = createNeedNormalizer({
    kind: proposal.kind,
    target: proposal.target,
    taskRevision: String(proposal.taskRevision),
    proposalId: proposal.proposalId,
    evidenceRefs: [...proposal.evidenceRefs],
    evidenceStrength: proposal.evidenceStrength as NeedProposal["evidenceStrength"],
  });
  const validated = normalizer.fire("validate_need");
  if (!validated.ok) return validated.reason ?? "(need layer produced no reason)";
  const normalizedTransition = normalizer.fire("normalize_need");
  if (!normalizedTransition.ok) {
    return (
      normalizer.unresolvedRecord?.reason ??
      normalizedTransition.reason ??
      "(need layer produced no reason)"
    );
  }
  return "(need layer normalized the proposal)";
}

describe("composition-shell evaluation (wanna-15e)", () => {
  it("unsupported-boundary-representation — evaluateNeed refuses non-review kinds, noncanonical or conflicting revisions, and round-trips canonical numeric/string revisions losslessly without mutation", async () => {
    const store = new FakeReviewStore();
    const shell = await shellAtTaskRevision(store, 7);
    const baseline = store.rawState(KEY);
    const versionBefore = baseline.aggregateVersion;

    // Only review_artifact is accepted; the refusal names the requested kind.
    const unsupported = await shell.evaluateNeed(
      proposalInput({ kind: "deploy_service" }),
    );
    if (unsupported.kind !== "unsupported_kind")
      throw new Error(`expected unsupported_kind, got ${unsupported.kind}`);
    expect(unsupported.requestedKind).toBe("deploy_service");

    // Noncanonical and unsafe revisions are typed refusals, never parsed.
    for (const [label, revision] of [
      ["leading-zero string", "07"],
      ["fractional string", "7.5"],
      ["exponent string", "1e3"],
      ["negative string", "-1"],
      ["empty string", ""],
      ["fractional number", 7.5],
      ["negative number", -1],
      ["unsafe number", Number.MAX_SAFE_INTEGER + 1],
    ] as const) {
      const outcome = await shell.evaluateNeed(
        proposalInput({ taskRevision: revision }),
      );
      assertRefused(outcome, `noncanonical revision (${label})`);
    }

    // Conflicting inputs: a need for a revision other than the authoritative
    // artifact revision is refused without mutation.
    const conflict = await shell.evaluateNeed(
      proposalInput({ taskRevision: 8 }),
    );
    const conflictReason = assertRefused(conflict, "conflicting revision");
    expect(conflictReason).toContain("8");
    expect(conflictReason).toContain("7");

    // Canonical numeric and string revisions round-trip losslessly: both land
    // as the same numeric decision revision.
    for (const form of [7, "7"] as const) {
      const decided = await shell.evaluateNeed(
        proposalInput({ taskRevision: form }),
      );
      if (decided.kind !== "decided")
        throw new Error(`expected decided for revision form ${String(form)}, got ${decided.kind}`);
      expect(decided.taskRevision).toBe(7);
    }

    // Refusals and decisions leave committed state untouched (evaluation
    // alone mutates nothing — commit is wanna-8k6's path).
    expect(store.rawState(KEY).aggregateVersion).toBe(versionBefore);
    expect(shell.project().taskRevision).toBe(7);
    expect(shell.project().pendingReviews).toHaveLength(0);
    expect(shell.project().completedReviews).toHaveLength(0);
  });

  it("un-normalized-need-refused-before-evaluation — a malformed or un-normalized need surfaces the need layer's typed refusal unchanged, before any evaluation could run", async () => {
    const store = new FakeReviewStore();
    const shell = await shellAtTaskRevision(store, 7);
    const versionBefore = store.rawState(KEY).aggregateVersion;

    // Malformed need: presentation vocabulary in the target. Evidence is
    // present and sufficient, so if the shell evaluated anyway the pipeline
    // would reach a decision — the refusal proves normalization ran first.
    const malformed = await shell.evaluateNeed(
      proposalInput({ target: "modal editor" }),
    );
    const malformedReason = assertRefused(malformed, "malformed need");
    expect(malformedReason).toBe(
      needLayerReason(proposalInput({ target: "modal editor" })),
    );
    expect(malformedReason).toContain("presentation vocabulary");

    // Un-normalized need: evidence below the immediate threshold leaves the
    // need unresolved — refused with the need layer's unresolved reason.
    const unresolved = await shell.evaluateNeed(
      proposalInput({ evidenceStrength: "weak" }),
    );
    const unresolvedReason = assertRefused(unresolved, "un-normalized need");
    expect(unresolvedReason).toBe(
      needLayerReason(proposalInput({ evidenceStrength: "weak" })),
    );
    expect(unresolvedReason).toContain("need_target_immediate");

    // Neither refusal created an interaction or touched committed state.
    expect(store.rawState(KEY).aggregateVersion).toBe(versionBefore);
    expect(shell.project().pendingReviews).toHaveLength(0);
    expect(shell.project().completedReviews).toHaveLength(0);
  });

  it("decision-result-carries-pinned-versions — the decision retains proposal and evidence identity and pins evaluation versions independently of the runtime surface version", async () => {
    const store = new FakeReviewStore();
    const shell = await shellAtTaskRevision(
      store,
      7,
      "policy-alpha",
      "catalog-alpha",
    );
    const decided = await shell.evaluateNeed(proposalInput());
    if (decided.kind !== "decided")
      throw new Error(`expected decided, got ${decided.kind}`);

    // Decision identity retains the proposal and its evidence.
    expect(decided.provenance.proposalId).toBe("proposal-7");
    expect(decided.provenance.evidenceRefs).toEqual([
      "artifact-1/revisions/7",
    ]);
    expect(decided.provenance.normalizerIdentity).toBe(NORMALIZER_VERSION);
    expect(decided.provenance.taxonomyVersion).toBe(TAXONOMY_VERSION);

    // Evaluation versions are pinned from the consumer's immutable inputs.
    expect(decided.provenance.policyVersion).toBe("policy-alpha");
    expect(decided.provenance.catalogVersion).toBe("catalog-alpha");

    // The fixed runtime policy constant is never reported as the evaluation policy.
    expect(decided.provenance.policyVersion).not.toBe(RUNTIME_POLICY_CONSTANT);

    // Evaluation and runtime version identities are distinct fields, each
    // pinned — not constant-equal and not constant-unequal by construction.
    expect(decided.provenance.shellVersion).toBe(COMPOSITION_SHELL_VERSION);
    const different = new FakeReviewStore();
    const otherShell = await shellAtTaskRevision(
      different,
      7,
      COMPOSITION_SHELL_VERSION,
      "catalog-beta",
    );
    const otherDecision = await otherShell.evaluateNeed(proposalInput());
    if (otherDecision.kind !== "decided")
      throw new Error(`expected decided, got ${otherDecision.kind}`);
    // The evaluation pin follows the input even when it coincides with the
    // runtime version — the two identities are independently configurable.
    expect(otherDecision.provenance.policyVersion).toBe(COMPOSITION_SHELL_VERSION);
    expect(otherDecision.provenance.catalogVersion).toBe("catalog-beta");
    expect(otherDecision.provenance.shellVersion).toBe(COMPOSITION_SHELL_VERSION);
  });

  it("excluded-or-empty-candidates — a hard-gate excluded candidate carries its policy reason and never re-enters, and zero eligible candidates returns no_candidate without creating an interaction", async () => {
    const store = new FakeReviewStore();
    const shell = await shellAtTaskRevision(store, 7);
    const versionBefore = store.rawState(KEY).aggregateVersion;

    // Zero eligible candidates: without revision evidence the trusted review
    // candidate fails a hard eligibility gate, so the decision is no_candidate
    // carrying exclusions with the POLICY layer's reason codes (not the
    // engine's priority vocabulary).
    const empty = await shell.evaluateNeed(
      proposalInput({ evidenceRefs: [] }),
    );
    if (empty.kind !== "no_candidate")
      throw new Error(`expected no_candidate, got ${empty.kind}`);
    expect(empty.exclusions.length).toBeGreaterThan(0);
    for (const exclusion of empty.exclusions) {
      expect(exclusion.id.length).toBeGreaterThan(0);
      expect(REASON_CODES).toContain(exclusion.reasonCode);
      // policy order/exclusion vocabulary preserved separately from the
      // engine's ordinal exclusion reason
      expect(exclusion.reasonCode).not.toBe("priority_not_positive");
    }
    expect(
      empty.exclusions.some((e) => e.reasonCode === "required_input_missing"),
    ).toBe(true);

    // The excluded candidate cannot re-enter: a second identical evaluation
    // is again refused as no_candidate with the same exclusions — the
    // excluded candidate is never recommended into a review.
    const again = await shell.evaluateNeed(proposalInput({ evidenceRefs: [] }));
    if (again.kind !== "no_candidate")
      throw new Error(`expected no_candidate again, got ${again.kind}`);
    expect(again.exclusions).toEqual(empty.exclusions);

    // An excluded candidate never becomes a committed review.
    expect(shell.project().pendingReviews).toHaveLength(0);
    expect(shell.project().completedReviews).toHaveLength(0);
    expect(store.rawState(KEY).aggregateVersion).toBe(versionBefore);

    // With evidence present the eligible candidate is recommended while the
    // never-verifiable alternative stays excluded with its reason — within a
    // decision, no excluded candidate re-enters the recommendations.
    const decided = await shell.evaluateNeed(proposalInput());
    if (decided.kind !== "decided")
      throw new Error(`expected decided with evidence, got ${decided.kind}`);
    expect(decided.recommendations.length).toBeGreaterThan(0);
    expect(decided.provenance.exclusions.length).toBeGreaterThan(0);
    for (const exclusion of decided.provenance.exclusions) {
      expect(REASON_CODES).toContain(exclusion.reasonCode);
      expect(
        decided.recommendations.some((r) => r.id === exclusion.id),
        `excluded candidate ${exclusion.id} re-entered the decision`,
      ).toBe(false);
    }
    // the never-verifiable alternative is the carried exclusion
    expect(
      decided.provenance.exclusions.some(
        (e) =>
          e.id === `verified-review:artifact-1@7` &&
          e.reasonCode === "required_input_missing",
      ),
    ).toBe(true);
  });
});
