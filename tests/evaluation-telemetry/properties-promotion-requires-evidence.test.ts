// Purpose: conformance property tests for the promotion_requires_evidence invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/promotion-requires-evidence-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { promotionRequiresEvidence } from "../../src/evaluation-telemetry/invariants";
import { failureOf, WORKLOAD, allGatesPass, validGate, validRecord } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant promotion_requires_evidence at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: all four declared gates pass for the relevant workload
    expect(promotionRequiresEvidence(validRecord()).ok).toBe(true);
    // edge case: a missing gate kind is named precisely
    const noLatency = promotionRequiresEvidence(
      validRecord({ gateResults: allGatesPass().slice(0, 3) }),
    );
    expect(noLatency.ok).toBe(false);
    expect(failureOf(noLatency)).toBe(
      `guard promotion_requires_evidence does not hold: no latency gate result for workload "${WORKLOAD}"`,
    );
    // edge case: a failing gate is named precisely
    const failedSafety = promotionRequiresEvidence(
      validRecord({
        gateResults: allGatesPass().map((g) => (g.kind === "safety" ? { ...g, passed: false } : g)),
      }),
    );
    expect(failedSafety.ok).toBe(false);
    expect(failureOf(failedSafety)).toBe(
      `guard promotion_requires_evidence does not hold: safety gate has not passed for workload "${WORKLOAD}"`,
    );
    // edge case: a gate passed for a different workload is not evidence for this one
    const otherWorkload = promotionRequiresEvidence(
      validRecord({
        gateResults: [
          validGate("quality", { workloadRevision: "wl-9" }),
          validGate("safety"),
          validGate("cost"),
          validGate("latency"),
        ],
      }),
    );
    expect(otherWorkload.ok).toBe(false);
    expect(failureOf(otherWorkload)).toBe(
      `guard promotion_requires_evidence does not hold: no quality gate result for workload "${WORKLOAD}"`,
    );
  });
});