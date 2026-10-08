// Purpose: property tests for the interaction amplification policy
// Responsibilities: each corpus property of amplification-policy as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/amplification-policy/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createAmplificationPolicy } from "../../src/amplification-policy/machine";
import {
  RISK_CLASS_ASSURANCE_FLOOR,
  RISK_CLASS_REVIEW_BASELINE,
  REVIEW_LEVEL_ORDER,
  evidenceEscalation,
  requiredReviewLevel,
  REASON_CODES,
} from "../../src/amplification-policy/invariants";
import { candidate, context } from "./fixtures";
import type { PolicyContext } from "../../src/amplification-policy/types";

function run(ctx: PolicyContext, candidates = [candidate()]) {
  const m = createAmplificationPolicy(ctx, candidates);
  m.fire("normalize_context");
  const evaluated = m.fire("evaluate_candidates");
  if (evaluated.ok) {
    // least burden includes zero burden: prefer the no-op when the guard allows it
    const noop = m.fire("return_no_candidate");
    if (!noop.ok) m.fire("select_candidate");
  }
  return { m, decision: m.decision, selected: m.decision?.selected ?? null };
}

describe("amplification-policy properties", () => {
  it("TypeScript conformance test: assert invariant risk_floor_preserved at its trust boundary and under its stated edge cases.", () => {
    // each risk class carries a declared assurance floor
    expect(RISK_CLASS_ASSURANCE_FLOOR).toEqual({ low: 0, medium: 1, high: 2, critical: 3 });
    // a candidate above the floor is eligible even when a lower-friction option exists
    const { decision } = run(
      context({ riskClass: "high" }),
      [
        candidate({ id: "cheap-weak", declaredHumanEffort: 1, declaredAssurance: 0 }),
        candidate({ id: "costly-strong", declaredHumanEffort: 5, declaredAssurance: 2 }),
      ],
    );
    expect(decision?.selected).toEqual([{ id: "costly-strong", reasonCode: "selected_least_burden" }]);
    expect(decision?.exclusions).toEqual([
      { id: "cheap-weak", reasonCode: "assurance_floor_unmet" },
    ]);
    // at the boundary: a candidate exactly at the floor is eligible
    const atFloor = run(
      context({ riskClass: "high" }),
      [candidate({ id: "boundary", declaredAssurance: 2 })],
    );
    expect(atFloor.decision?.selected[0]?.id).toBe("boundary");
    // a candidate below the floor on a critical task is excluded
    const below = run(context({ riskClass: "critical" }), [candidate({ declaredAssurance: 2 })]);
    expect(below.decision?.exclusions).toEqual([
      { id: "cand-1", reasonCode: "assurance_floor_unmet" },
    ]);
  });

  it("TypeScript conformance test: assert invariant least_burden_candidate at its trust boundary and under its stated edge cases.", () => {
    // the candidate with the lowest declared expected human effort wins among eligible candidates
    const { decision } = run(context(), [
      candidate({ id: "heavy", declaredHumanEffort: 9 }),
      candidate({ id: "light", declaredHumanEffort: 1 }),
      candidate({ id: "middle", declaredHumanEffort: 4 }),
    ]);
    expect(decision?.selected).toEqual([{ id: "light", reasonCode: "selected_least_burden" }]);
    // ties are broken deterministically by candidate identity, not by list order
    const tie = run(context(), [
      candidate({ id: "b-tie", declaredHumanEffort: 3 }),
      candidate({ id: "a-tie", declaredHumanEffort: 3 }),
    ]);
    expect(tie.decision?.selected).toEqual([{ id: "a-tie", reasonCode: "selected_least_burden" }]);
    expect(tie.decision?.eligible).toEqual(["a-tie", "b-tie"]);
    // the least-burden ranking follows the pinned scoring policy version
    expect(decision?.scoringPolicyVersion.length).toBeGreaterThan(0);
    // a candidate that does not declare its expected effort cannot be ranked at all
    const unrated = run(context(), [
      candidate({ id: "no-effort", declaredHumanEffort: undefined }),
      candidate({ id: "rated", declaredHumanEffort: 2 }),
    ]);
    expect(unrated.decision?.exclusions).toEqual([
      { id: "no-effort", reasonCode: "missing_declared_effort" },
    ]);
    expect(unrated.decision?.selected).toEqual([{ id: "rated", reasonCode: "selected_least_burden" }]);
  });

  it("TypeScript conformance test: assert invariant no_interaction_when_not_needed at its trust boundary and under its stated edge cases.", () => {
    // no human contribution required and no gates → no interaction
    const idle = run(
      context({ requiresHumanContribution: false, authorityGates: [], verificationGates: [] }),
    );
    expect(idle.decision?.outcome).toBe("no_candidate");
    expect(idle.m.state).toBe("no_candidate");
    // a required human contribution blocks the no-op — the policy must not silently skip
    const needed = run(
      context({ requiresHumanContribution: true, authorityGates: [], verificationGates: [] }),
    );
    expect(needed.m.state).not.toBe("no_candidate");
    // an open gate blocks the no-op even without a human contribution
    const gated = run(
      context({ requiresHumanContribution: false, verificationGates: ["check-signature"] }),
    );
    expect(gated.m.state).not.toBe("no_candidate");
  });

  it("TypeScript conformance test: assert invariant uncertainty_can_escalate at its trust boundary and under its stated edge cases.", () => {
    // escalation is monotone in evidence severity — never a decrease along the ladder
    const ladder = ["sufficient", "uncertain", "ambiguous", "conflicting"] as const;
    for (let i = 1; i < ladder.length; i++) {
      // invariant: i and i-1 are valid indices into ladder by loop construction
      const before = evidenceEscalation(ladder[i - 1]!);
      const after = evidenceEscalation(ladder[i]!);
      expect(REVIEW_LEVEL_ORDER.indexOf(after)).toBeGreaterThanOrEqual(
        REVIEW_LEVEL_ORDER.indexOf(before),
      );
    }
    // escalated review level never falls below the risk-class baseline
    for (const riskClass of ["low", "medium", "high", "critical"] as const) {
      for (const evidenceState of ladder) {
        const level = requiredReviewLevel(riskClass, evidenceState);
        const baseline = RISK_CLASS_REVIEW_BASELINE[riskClass];
        expect(REVIEW_LEVEL_ORDER.indexOf(level)).toBeGreaterThanOrEqual(
          REVIEW_LEVEL_ORDER.indexOf(baseline),
        );
      }
    }
    // the recorded decision carries the escalated level
    const escalated = run(context({ riskClass: "medium", evidenceState: "conflicting" }), [candidate()]);
    expect(escalated.decision?.reviewLevel).toBe("independent");
    const calm = run(context({ riskClass: "medium", evidenceState: "sufficient" }), [candidate()]);
    expect(calm.decision?.reviewLevel).toBe("self");
    // a critical task is never reviewed below its baseline, whatever the evidence says
    const critical = run(context({ riskClass: "critical", evidenceState: "sufficient" }), [candidate()]);
    expect(critical.decision?.reviewLevel).toBe("independent");
  });

  it("TypeScript conformance test: assert invariant decision_reasons_stable at its trust boundary and under its stated edge cases.", () => {
    // every selection and exclusion carries a stable reason code from the closed vocabulary
    const { decision } = run(context({ riskClass: "high" }), [
      candidate({ id: "weak", declaredHumanEffort: 1, declaredAssurance: 0 }),
      candidate({ id: "ok", declaredHumanEffort: 5, declaredAssurance: 2 }),
    ]);
    const entries = [...(decision?.selected ?? []), ...(decision?.exclusions ?? [])];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(REASON_CODES).toContain(entry.reasonCode);
    }
    // equal normalized contexts produce structurally equal reason-coded decisions
    const again = run(context({ riskClass: "high" }), [
      candidate({ id: "weak", declaredHumanEffort: 1, declaredAssurance: 0 }),
      candidate({ id: "ok", declaredHumanEffort: 5, declaredAssurance: 2 }),
    ]);
    expect(again.decision?.selected).toEqual(decision?.selected);
    expect(again.decision?.exclusions).toEqual(decision?.exclusions);
  });

  it("TypeScript conformance test: assert invariant preferences_are_soft_unless_declared at its trust boundary and under its stated edge cases.", () => {
    // soft presentation preferences break effort ties only — they never exclude
    const soft = run(context({ preferences: [{ kind: "presentation", capability: "textual" }] }), [
      candidate({ id: "gui", declaredHumanEffort: 3 }),
      candidate({ id: "textual", declaredHumanEffort: 3, capabilities: ["textual"] }),
    ]);
    expect(soft.decision?.selected).toEqual([{ id: "textual", reasonCode: "selected_least_burden" }]);
    // a soft preference cannot displace a strictly lower-effort candidate
    const strict = run(context({ preferences: [{ kind: "presentation", capability: "textual" }] }), [
      candidate({ id: "cheap", declaredHumanEffort: 1 }),
      candidate({ id: "textual", declaredHumanEffort: 9, capabilities: ["textual"] }),
    ]);
    expect(strict.decision?.selected).toEqual([{ id: "cheap", reasonCode: "selected_least_burden" }]);
    // a declared accessibility constraint is mandatory: a candidate lacking the capability is excluded
    const hard = run(
      context({ preferences: [{ kind: "accessibility", capability: "screen-reader" }] }),
      [
        candidate({ id: "cheap-but-inaccessible", declaredHumanEffort: 1 }),
        candidate({ id: "accessible", declaredHumanEffort: 7, capabilities: ["screen-reader"] }),
      ],
    );
    expect(hard.decision?.exclusions).toEqual([
      { id: "cheap-but-inaccessible", reasonCode: "hard_preference_unmet" },
    ]);
    expect(hard.decision?.selected).toEqual([{ id: "accessible", reasonCode: "selected_least_burden" }]);
  });

  it("TypeScript conformance test: assert invariant deterministic_after_normalization at its trust boundary and under its stated edge cases.", () => {
    // equal normalized contexts and pinned versions produce structurally equal decisions
    const mk = () =>
      run(
        context({ riskClass: "high", evidenceState: "ambiguous" }),
        [
          candidate({ id: "a", declaredHumanEffort: 2 }),
          candidate({ id: "b", declaredHumanEffort: 7 }),
        ],
      ).decision;
    expect(mk()).toEqual(mk());
    // decision ordering is stable too, not just set equality
    expect(mk()?.eligible).toEqual(mk()?.eligible);
  });
});
