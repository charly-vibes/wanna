// Purpose: conformance property tests for the metrics_versioned invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/metrics-versioned-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { metricsVersioned } from "../../src/evaluation-telemetry/invariants";
import { failureOf, validRecord } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant metrics_versioned at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: a fully identified evaluation record
    expect(metricsVersioned(validRecord()).ok).toBe(true);
    // edge case: each omitted identifier is named precisely
    const cases: ReadonlyArray<[string, Record<string, string>]> = [
      ["the candidate implementation", { candidateImplementation: "" }],
      ["the incumbent implementation", { incumbentImplementation: "" }],
      ["the dataset/workload revision", { workloadRevision: "" }],
      ["the evaluator version", { evaluatorVersion: "" }],
    ];
    for (const [label, override] of cases) {
      const check = metricsVersioned(validRecord(override));
      expect(check.ok).toBe(false);
      expect(failureOf(check)).toBe(
        `guard metrics_versioned does not hold: evaluation record does not identify ${label}`,
      );
    }
    // edge case: unversioned policy thresholds are not versioned provenance
    const noThresholds = metricsVersioned(validRecord({ policyThresholds: [] }));
    expect(noThresholds.ok).toBe(false);
    expect(failureOf(noThresholds)).toBe(
      "guard metrics_versioned does not hold: evaluation record does not identify the policy thresholds",
    );
  });
});