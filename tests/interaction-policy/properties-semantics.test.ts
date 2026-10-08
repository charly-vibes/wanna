// Purpose: semantic-layer properties for the interaction-policy evaluator
// Responsibilities: need-maps-before-presentation, adaptation-stability-gate, burden-inputs-typed, interruptions-require-justification
// Rationale: contribution semantics are selected from catalog mappings before any host concern; burden typing and interruption justification are hard gates
import { describe, it, expect } from "vitest";
import { createPolicyMachine } from "../../src/interaction-policy/machine";
import { eligibleCandidate, validInput } from "./fixtures";
import type { PolicyCandidate } from "../../src/interaction-policy/types";

describe("interaction-policy semantics properties", () => {
  it("Policy test: changing host component availability cannot silently change contribution semantics", () => {
    const pool: readonly PolicyCandidate[] = [
      eligibleCandidate({ id: "sem-a", kind: "clarify", score: 10 }),
      eligibleCandidate({
        id: "sem-b",
        kind: "choose",
        score: 9,
        requiredCapabilities: ["structured_prompting", "rich_widgets"],
        hostCapabilities: ["structured_prompting", "rich_widgets"],
      }),
    ];
    const idsOf = (result: { recommendations: readonly { id: string }[] }) =>
      result.recommendations.map((r) => r.id);
    // full host: both contribution kinds are eligible in deterministic order
    const full = createPolicyMachine(validInput({ candidates: pool }));
    const fullOutcome = full.evaluate();
    expect(fullOutcome.ok).toBe(true);
    if (!fullOutcome.ok) return;
    expect(idsOf(fullOutcome.result)).toEqual(["sem-a", "sem-b"]);
    expect(fullOutcome.result.recommendations.map((r) => r.kind)).toEqual(["clarify", "choose"]);
    // reduced host: sem-b is excluded, sem-a keeps its exact contribution kind and order
    const reduced = createPolicyMachine(
      validInput({
        candidates: pool.map((c) => ({
          ...c,
          hostCapabilities: ["structured_prompting"] as readonly string[],
        })),
      }),
    );
    const reducedOutcome = reduced.evaluate();
    expect(reducedOutcome.ok).toBe(true);
    if (!reducedOutcome.ok) return;
    expect(idsOf(reducedOutcome.result)).toEqual(["sem-a"]);
    expect(reducedOutcome.result.recommendations[0]?.kind).toBe("clarify");
    expect(reducedOutcome.result.exclusions).toEqual([{ id: "sem-b", reasonCode: "host_capability_missing" }]);
    // augmented host with an unrelated capability: the result is byte-identical to the full run
    const augmented = createPolicyMachine(
      validInput({
        candidates: pool.map((c) => ({
          ...c,
          hostCapabilities: ["structured_prompting", "rich_widgets", "voice_widgets"] as readonly string[],
        })),
      }),
    );
    const augmentedOutcome = augmented.evaluate();
    expect(augmentedOutcome.ok).toBe(true);
    if (!augmentedOutcome.ok) return;
    expect(augmentedOutcome.result).toEqual(fullOutcome.result);
  });

  it("Interaction test: active response surface remains semantically stable", () => {
    const unsafe = eligibleCandidate({
      id: "adapt-unsafe",
      kind: "choose",
      adaptation: { replacesActive: true, duringResponseEntry: true, safetyRelated: false },
    });
    const m = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ id: "stable-1" }), unsafe] }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // the mid-input replacement is rejected, the active surface keeps its interaction
    expect(outcome.result.exclusions).toEqual([{ id: "adapt-unsafe", reasonCode: "mid_input_adaptation_blocked" }]);
    expect(outcome.result.recommendations.map((r) => r.id)).toEqual(["stable-1"]);
    expect(outcome.result.recommendations.map((r) => r.kind)).toEqual(["clarify"]);
    // the same replacement declared safety-related passes the gate
    const safety = { ...unsafe, id: "adapt-safety", adaptation: { ...unsafe.adaptation!, safetyRelated: true } };
    const m2 = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ id: "stable-1" }), safety] }));
    const outcome2 = m2.evaluate();
    expect(outcome2.ok).toBe(true);
    if (!outcome2.ok) return;
    expect(outcome2.result.exclusions).toHaveLength(0);
    // and the surviving active interaction is semantically identical to the run without any adaptation
    expect(outcome2.result.recommendations.find((r) => r.id === "stable-1")?.kind).toBe(
      outcome.result.recommendations.find((r) => r.id === "stable-1")?.kind,
    );
    expect(outcome2.result.recommendations.find((r) => r.id === "stable-1")?.kind).toBe("clarify");
  });

  it("policy distinguishes measurable burden attributes from uncertain inferred human-state attributes and records which influenced ranking", () => {
    const pool: readonly PolicyCandidate[] = [
      eligibleCandidate({
        id: "burden-a",
        score: 9,
        burdenAttributes: [
          { name: "context_switch_cost", measurable: true, value: 2 },
          { name: "perceived_fatigue", measurable: false, value: 5 },
        ],
      }),
      eligibleCandidate({
        id: "burden-b",
        kind: "choose",
        score: 9,
        burdenAttributes: [{ name: "perceived_fatigue", measurable: false, value: 5 }],
      }),
    ];
    const m = createPolicyMachine(validInput({ candidates: pool }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // identical scores → tie-break by id; the inferred attribute did not influence ranking
    expect(outcome.result.recommendations.map((r) => r.id)).toEqual(["burden-a", "burden-b"]);
    expect(outcome.result.burdenInfluence).toEqual({ "burden-a": ["context_switch_cost"] });
    expect(outcome.result.burdenAdvisory).toEqual({
      "burden-a": ["perceived_fatigue"],
      "burden-b": ["perceived_fatigue"],
    });
    // changing inferred values across runs never changes the ordering or the influence record
    const rerun = createPolicyMachine(
      validInput({
        candidates: pool.map((c) => ({
          ...c,
          burdenAttributes: c.burdenAttributes!.map((a) =>
            a.measurable ? a : { ...a, value: 99 },
          ),
        })),
      }),
    );
    const rerunOutcome = rerun.evaluate();
    expect(rerunOutcome.ok).toBe(true);
    if (!rerunOutcome.ok) return;
    expect(rerunOutcome.result.recommendations.map((r) => r.id)).toEqual(["burden-a", "burden-b"]);
    expect(rerunOutcome.result.burdenInfluence).toEqual(outcome.result.burdenInfluence);
  });

  it("a proactive interruption is eligible only with an unresolved target, expected benefit, urgency/risk rationale, and reason deferral is insufficient", () => {
    const interrupt = (overrides: Partial<NonNullable<PolicyCandidate["interruption"]>>, id: string) =>
      eligibleCandidate({
        id,
        kind: "choose",
        interruption: {
          targetUnresolved: true,
          expectedBenefit: "prevents a wrong artifact from being committed",
          urgencyRationale: "the task completes in two minutes",
          ...overrides,
        },
      });
    const pool: readonly PolicyCandidate[] = [
      interrupt({}, "int-ok"),
      interrupt({ targetUnresolved: false }, "int-target-resolved"),
      interrupt({ expectedBenefit: "" }, "int-no-benefit"),
      interrupt({ urgencyRationale: "" }, "int-no-urgency"),
      interrupt({ urgencyRationale: "deferred" }, "int-deferred"),
    ];
    const m = createPolicyMachine(validInput({ candidates: pool }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.recommendations.map((r) => r.id)).toEqual(["int-ok"]);
    const byId = new Map(outcome.result.exclusions.map((e) => [e.id, e.reasonCode]));
    expect(byId.get("int-target-resolved")).toBe("interruption_justification_insufficient");
    expect(byId.get("int-no-benefit")).toBe("interruption_justification_insufficient");
    expect(byId.get("int-no-urgency")).toBe("interruption_justification_insufficient");
    expect(byId.get("int-deferred")).toBe("interruption_justification_insufficient");
    // a candidate with no interruption declaration is not proactive — the gate does not apply
    const plain = createPolicyMachine(validInput());
    const plainOutcome = plain.evaluate();
    expect(plainOutcome.ok).toBe(true);
    if (!plainOutcome.ok) return;
    expect(plainOutcome.result.exclusions).toHaveLength(0);
  });
});