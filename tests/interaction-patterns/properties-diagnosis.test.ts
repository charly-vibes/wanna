// Purpose: property test for diagnosis_is_iterative_bounded (p-diagnosis-is-iterative-bounded)
// Responsibilities: diagnosis patterns model the five phases and terminate through a bound or an interrupt
// Rationale: contract .espectacular/interaction-patterns/p-diagnosis-is-iterative-bounded.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { diagnosisIsBounded } from "../../src/interaction-patterns/invariants";
import { diagnosisPattern, node } from "./fixtures";
import type { PatternDefinition } from "../../src/interaction-patterns/types";

describe("interaction-patterns properties: diagnosis", () => {
  it("diagnosis patterns explicitly model inspect, hypothesis/evaluation, evidence acquisition, correction proposal, and exit conditions; loops have bounded or externally interruptible termination", () => {
    // a canonical diagnosis pattern models all five phases with a bounded loop
    expect(diagnosisIsBounded(diagnosisPattern()).ok).toBe(true);
    // each missing phase is named precisely
    for (const phase of ["inspect", "hypothesis", "evidence", "correction", "exit"] as const) {
      const missing = diagnosisPattern({
        nodes: diagnosisPattern().nodes.filter((n) => n.diagnosisPhase !== phase),
      });
      const check = diagnosisIsBounded(missing);
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(`diagnosis pattern is missing the "${phase}" phase`);
    }
    // a diagnosis node outside the five declared phases is refused
    const foreign = diagnosisPattern({
      nodes: [...diagnosisPattern().nodes, node({ id: "d-wander", primitiveId: "primitive.deliver", diagnosisPhase: "ponder" as never })],
    });
    expect(diagnosisIsBounded(foreign).reason).toBe(
      'diagnosis node "d-wander" declares unknown phase "ponder"',
    );
    // an unbounded, non-interruptible loop never terminates — refused
    const unbounded: PatternDefinition = { ...diagnosisPattern(), maxIterations: undefined, interruptible: undefined };
    expect(diagnosisIsBounded(unbounded).reason).toBe(
      "diagnosis loops must declare a bounded iteration count or an externally interruptible termination",
    );
    // an externally interruptible termination is an acceptable exit condition
    const interruptible: PatternDefinition = { ...diagnosisPattern(), maxIterations: undefined, interruptible: true };
    expect(diagnosisIsBounded(interruptible).ok).toBe(true);
    // a non-positive bound is no bound
    const zero = diagnosisPattern({ maxIterations: 0 });
    expect(diagnosisIsBounded(zero).reason).toBe(
      "diagnosis loops must declare a bounded iteration count or an externally interruptible termination",
    );
  });
});
