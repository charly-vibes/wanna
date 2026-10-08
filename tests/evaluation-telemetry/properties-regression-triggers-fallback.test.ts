// Purpose: conformance property tests for the regression_triggers_fallback invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/regression-triggers-fallback-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { regressionTriggersFallback, rollbackAllowed } from "../../src/evaluation-telemetry/invariants";
import { breach, validRecovery } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant regression_triggers_fallback at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: a breach signal entering the recovery decision
    expect(regressionTriggersFallback(breach("quality"), validRecovery()).ok).toBe(true);
    expect(rollbackAllowed(validRecovery()).ok).toBe(true);
    // edge case: no explicit recovery policy declared
    const undeclared = regressionTriggersFallback(breach("safety"), validRecovery({ declared: false }));
    expect(undeclared.ok).toBe(false);
    expect(undeclared.reason).toBe(
      "guard regression_triggers_fallback does not hold: no explicit recovery policy is declared for the promoted implementation",
    );
    // edge case: policy declared but no fallback for the breached guard kind
    const uncovered = regressionTriggersFallback(breach("safety"), validRecovery({ fallbackFor: ["quality"] }));
    expect(uncovered.ok).toBe(false);
    expect(uncovered.reason).toBe(
      "guard regression_triggers_fallback does not hold: the recovery policy does not declare a fallback for the safety guard breach",
    );
    // edge case: degradation detected but rollback not permitted by the policy
    const noRollback = rollbackAllowed(validRecovery({ allowsRollback: false }));
    expect(noRollback.ok).toBe(false);
    expect(noRollback.reason).toBe(
      "guard regression_triggers_fallback does not hold: the recovery policy does not permit rollback",
    );
  });
});