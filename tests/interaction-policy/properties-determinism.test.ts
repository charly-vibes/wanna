// Purpose: determinism and observability properties for the interaction-policy evaluator
// Responsibilities: permutation-invariant ordering, pinned version recording, fail-closed malformed input
// Rationale: ordering is a pure function of declared score fields plus a stable tie-break key; results are fully observable
import { describe, it, expect } from "vitest";
import { createPolicyMachine } from "../../src/interaction-policy/machine";
import { POLICY_VERSION, TIE_BREAK_RULE_VERSION } from "../../src/interaction-policy/types";
import { CATALOG_V7, eligibleCandidate, validInput } from "./fixtures";

describe("interaction-policy determinism properties", () => {
  it("TypeScript test: permutations of the same candidate set return the same ordered recommendation IDs and reasons", () => {
    const pool = [
      eligibleCandidate({ id: "cand-a", score: 5 }),
      eligibleCandidate({ id: "cand-b", kind: "choose", score: 9 }),
      eligibleCandidate({ id: "cand-c", kind: "rank", score: 9 }),
      eligibleCandidate({ id: "cand-d", kind: "choose", failedHardGates: ["export_restricted"] }),
    ];
    const permutations = [
      pool,
      [...pool].reverse(),
      [pool[1]!, pool[2]!, pool[3]!, pool[0]!],
      [pool[3]!, pool[0]!, pool[2]!, pool[1]!],
    ];
    const expectedIds = ["cand-b", "cand-c", "cand-a"];
    const expectedExclusions = [{ id: "cand-d", reasonCode: "hard_gate_failed:export_restricted" }];
    for (const permuted of permutations) {
      const m = createPolicyMachine(validInput({ candidates: permuted }));
      const outcome = m.evaluate();
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(outcome.result.recommendations.map((r) => r.id)).toEqual(expectedIds);
      expect(outcome.result.exclusions).toEqual(expectedExclusions);
    }
  });

  it("TypeScript test: result contains the exact pinned policy/catalog/tie-break versions and ranking metadata", () => {
    const m = createPolicyMachine(validInput());
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const result = outcome.result;
    expect(result.policyVersion).toBe(POLICY_VERSION);
    expect(result.catalogVersion).toBe(CATALOG_V7.version);
    expect(result.tieBreakRuleVersion).toBe(TIE_BREAK_RULE_VERSION);
    expect(result.rankingKeys).toEqual(["score", "id"]);
    expect(result.needIdentity).toBe("clarify_intent:need-prop-9@task-11");
    // every recommendation carries its ranking keys
    for (const r of result.recommendations) {
      expect(typeof r.score).toBe("number");
      expect(r.tieBreakKey.length).toBeGreaterThan(0);
    }
  });

  it("TypeScript test: malformed or version-incomplete input returns a typed failure and no recommendation", () => {
    const malformed: readonly PolicyInputVariant[] = [
      validInput({ need: { ...validInput().need, kind: "" } }),
      validInput({ policyVersion: "drifted@9.9.9" }),
      validInput({ catalog: { ...CATALOG_V7, version: "" } }),
      validInput({ context: { taskRevision: "", userPreferences: [] } }),
    ];
    for (const input of malformed) {
      const m = createPolicyMachine(input);
      const outcome = m.evaluate();
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.reason.startsWith("policy_input_valid fails:")).toBe(true);
      expect(m.state).toBe("failed");
      expect(m.lastResult).toBeNull();
    }
  });
});

type PolicyInputVariant = ReturnType<typeof validInput>;