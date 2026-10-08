// Purpose: conformance property tests for the agreement_not_correctness invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/agreement-not-correctness-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { agreementNotCorrectness } from "../../src/evaluation-telemetry/invariants";
import { validAgreement } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant agreement_not_correctness at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: an agreement record entering the evaluation layer
    expect(agreementNotCorrectness(validAgreement()).ok).toBe(true);
    // edge case: agreement relabeled as correctness ground truth is refused, naming the incumbent
    const relabeled = agreementNotCorrectness(
      validAgreement({ recordedAs: "correctness" }),
    );
    expect(relabeled.ok).toBe(false);
    expect(relabeled.reason).toBe(
      'guard agreement_not_correctness does not hold: agreement with incumbent "impl-incumbent@1.4.0" is recorded as correctness ground truth',
    );
    // edge case: independently established correctness may be recorded as correctness
    const independent = agreementNotCorrectness(
      validAgreement({ basis: "independent_verification", recordedAs: "correctness" }),
    );
    expect(independent.ok).toBe(true);
    // edge case: disagreement with the incumbent is never correctness by agreement either
    expect(agreementNotCorrectness(validAgreement({ recordedAs: "agreement" })).ok).toBe(true);
  });
});