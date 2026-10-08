// Purpose: conformance property tests for the metrics_have_definitions invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/metrics-have-definitions-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { metricsHaveDefinitions } from "../../src/evaluation-telemetry/invariants";
import { validMetric, validRecord } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant metrics_have_definitions at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: every metric in the record's definition set is checked
    expect(metricsHaveDefinitions(validRecord().metrics).ok).toBe(true);
    // edge case: each omitted dimension is named precisely
    const dimensions = [
      "name", "unit", "population", "sampling method",
      "missing-data behavior", "interpretation limits",
    ] as const;
    for (const dimension of dimensions) {
      const field = {
        "name": "name",
        "unit": "unit",
        "population": "population",
        "sampling method": "samplingMethod",
        "missing-data behavior": "missingDataBehavior",
        "interpretation limits": "interpretationLimits",
      }[dimension];
      const metric = validMetric({ [field]: "" });
      const check = metricsHaveDefinitions([metric]);
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(
        `guard metrics_have_definitions does not hold: metric "${metric.name}" does not declare ${dimension}`,
      );
    }
    // edge case: a metric with no name is still checked, reported anonymously
    const unnamed = validMetric({ name: "", unit: "" });
    const check = metricsHaveDefinitions([unnamed]);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(
      'guard metrics_have_definitions does not hold: metric "" does not declare name, unit',
    );
  });
});