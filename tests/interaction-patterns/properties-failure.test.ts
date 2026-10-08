// Purpose: property test for pattern_failure_recorded (p-pattern-failure-recorded)
// Responsibilities: failure is a declared completion condition and the failure instance is recorded for replay and audit
// Rationale: contract .espectacular/interaction-patterns/p-pattern-failure-recorded.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { genericPattern, REGISTRY, reviewPattern } from "./fixtures";
import type { PatternDefinition } from "../../src/interaction-patterns/types";

describe("interaction-patterns properties: failure recording", () => {
  it("failure is a declared completion condition ∧ instance recorded for replay and audit", () => {
    // arbitrary failed patterns: different kinds, versions, and failure details
    const failedPatterns: readonly { def: PatternDefinition; detail: string }[] = [
      { def: genericPattern(), detail: "upstream dependency vanished" },
      { def: genericPattern({ version: "1.2.0" }), detail: "evidence source became unreachable" },
      { def: reviewPattern(), detail: "the review could not reach a verification quorum" },
    ];
    for (const { def, detail } of failedPatterns) {
      const m = createPatternMachine(def, REGISTRY);
      m.fire("validate_pattern");
      m.fire("start_pattern");
      m.fire("fail_pattern", detail);
      // failure is one of the pattern's declared completion conditions
      expect(def.conditions).toContain("failure");
      // the failure instance is recorded with the pattern instance for replay and audit
      expect(m.failureRecord).toEqual({
        effect: "interaction.patterns.pattern_failure",
        detail,
        patternId: def.patternId,
        patternVersion: def.version,
      });
      // the emitted effect is visible on the instance alongside the record
      expect(m.emittedEffects).toEqual([
        { effect: "interaction.patterns.pattern_failure", detail, patternId: def.patternId, patternVersion: def.version },
      ]);
      // the history carries the transition that produced the failure
      expect(m.history.at(-1)).toEqual({
        id: "fail_pattern",
        from: "running",
        to: "failed",
        patternVersion: def.version,
      });
    }
  });
});
