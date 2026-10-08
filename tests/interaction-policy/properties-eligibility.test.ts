// Purpose: eligibility properties for the interaction-policy evaluator
// Responsibilities: ineligible-candidates-never-return, no-candidate-is-explicit, exclusions-are-explainable, recommendation-count-is-bounded
// Rationale: gate exclusions must be complete, explicit, explainable, and bounded — never invented around
import { describe, it, expect } from "vitest";
import { createPolicyMachine } from "../../src/interaction-policy/machine";
import { REASON_CODES } from "../../src/interaction-policy/invariants";
import { eligibleCandidate, validInput } from "./fixtures";
import type { PolicyCandidate } from "../../src/interaction-policy/types";

function gateFailureVariants(): readonly PolicyCandidate[] {
  return [
    eligibleCandidate({ id: "g-kind", kind: "nonsense_kind" }),
    eligibleCandidate({ id: "g-catalog", kind: "verify" }), // not mapped for clarify_intent
    eligibleCandidate({ id: "g-input", requiredInputs: ["missing_input"] }),
    eligibleCandidate({ id: "g-host", requiredCapabilities: ["voice_widgets"] }),
    eligibleCandidate({ id: "g-hard", failedHardGates: ["export_restricted"] }),
    eligibleCandidate({
      id: "g-interrupt",
      interruption: { targetUnresolved: true, expectedBenefit: "", urgencyRationale: "" },
    }),
    eligibleCandidate({
      id: "g-adapt",
      adaptation: { replacesActive: true, duringResponseEntry: true, safetyRelated: false },
    }),
  ];
}

describe("interaction-policy eligibility properties", () => {
  it("TypeScript test: no candidate failing any hard eligibility gate appears in recommendations", () => {
    const m = createPolicyMachine(validInput({ candidates: gateFailureVariants() }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.recommendations).toHaveLength(0);
    const byId = new Map(outcome.result.exclusions.map((e) => [e.id, e.reasonCode]));
    expect(byId.get("g-kind")).toBe("kind_unsupported");
    expect(byId.get("g-catalog")).toBe("catalog_constraint_violation");
    expect(byId.get("g-input")).toBe("required_input_missing");
    expect(byId.get("g-host")).toBe("host_capability_missing");
    expect(byId.get("g-hard")).toBe("hard_gate_failed:export_restricted");
    expect(byId.get("g-interrupt")).toBe("interruption_justification_insufficient");
    expect(byId.get("g-adapt")).toBe("mid_input_adaptation_blocked");
    // mixed pool: eligible candidates survive, gated ones never leak into recommendations
    const mixed = createPolicyMachine(
      validInput({
        candidates: [
          eligibleCandidate({ id: "ok-1" }),
          ...gateFailureVariants(),
          eligibleCandidate({ id: "ok-2", kind: "choose", score: 4 }),
        ],
      }),
    );
    const mixedOutcome = mixed.evaluate();
    expect(mixedOutcome.ok).toBe(true);
    if (!mixedOutcome.ok) return;
    expect(mixedOutcome.result.recommendations.map((r) => r.id)).toEqual(["ok-1", "ok-2"]);
    expect(mixedOutcome.result.exclusions.map((e) => e.id).sort()).toEqual(
      gateFailureVariants().map((c) => c.id).sort(),
    );
  });

  it("TypeScript test: zero eligible candidates returns the no-candidate result and does not invent an interaction", () => {
    const m = createPolicyMachine(validInput({ candidates: gateFailureVariants() }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.outcome).toBe("no_candidate");
    expect(outcome.result.recommendations).toHaveLength(0);
    expect(outcome.result.exclusions).toHaveLength(gateFailureVariants().length);
    expect(m.state).toBe("no_candidate");
  });

  it("TypeScript test: every excluded candidate has a known non-empty reason code", () => {
    const m = createPolicyMachine(
      validInput({ candidates: [...gateFailureVariants(), eligibleCandidate()] }),
    );
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.exclusions.length).toBeGreaterThan(0);
    for (const e of outcome.result.exclusions) {
      expect(e.reasonCode.length).toBeGreaterThan(0);
      const known =
        (REASON_CODES as readonly string[]).includes(e.reasonCode) ||
        e.reasonCode.startsWith("hard_gate_failed:");
      expect(known).toBe(true);
    }
  });

  it("TypeScript test: returned count never exceeds configured maximum and invalid maxima are rejected", () => {
    const four = [
      eligibleCandidate({ id: "a12", score: 12 }),
      eligibleCandidate({ id: "b10", kind: "choose", score: 10 }),
      eligibleCandidate({ id: "c8", kind: "rank", score: 8 }),
      eligibleCandidate({ id: "d6", kind: "choose", score: 6 }),
    ];
    const capped = createPolicyMachine(validInput({ candidates: four, maxRecommendations: 2 }));
    const cappedOutcome = capped.evaluate();
    expect(cappedOutcome.ok).toBe(true);
    if (!cappedOutcome.ok) return;
    expect(cappedOutcome.result.recommendations.map((r) => r.id)).toEqual(["a12", "b10"]);
    // at the boundary the full set fits
    const boundary = createPolicyMachine(validInput({ candidates: four, maxRecommendations: 4 }));
    const boundaryOutcome = boundary.evaluate();
    expect(boundaryOutcome.ok).toBe(true);
    if (!boundaryOutcome.ok) return;
    expect(boundaryOutcome.result.recommendations).toHaveLength(4);
    // invalid maxima are rejected as typed failures before any evaluation
    for (const max of [0, -3, 1.5, 65]) {
      const m = createPolicyMachine(validInput({ candidates: four, maxRecommendations: max }));
      const outcome = m.evaluate();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.reason).toBe(
        `policy_input_valid fails: invalid maximum ${max}: must be a positive integer ≤ 64`,
      );
      expect(m.state).toBe("failed");
    }
  });
});