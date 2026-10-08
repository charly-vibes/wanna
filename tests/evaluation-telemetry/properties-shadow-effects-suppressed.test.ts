// Purpose: conformance property tests for the shadow_effects_suppressed invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/shadow-effects-suppressed-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { shadowEffectsSuppressed } from "../../src/evaluation-telemetry/invariants";
import { failureOf, validCollection } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant shadow_effects_suppressed at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: a shadow-mode collection configuration
    expect(shadowEffectsSuppressed(validCollection({ mode: "shadow" })).ok).toBe(false);
    // edge case: shadow run with suppressed live effects holds
    expect(
      shadowEffectsSuppressed(validCollection({ mode: "shadow", suppressesLiveEffects: true })).ok,
    ).toBe(true);
    // edge case: shadow run with isolated test doubles holds
    expect(
      shadowEffectsSuppressed(validCollection({ mode: "shadow", usesIsolatedTestDoubles: true })).ok,
    ).toBe(true);
    // edge case: live mode is outside the invariant's scope
    expect(shadowEffectsSuppressed(validCollection({ mode: "live" })).ok).toBe(true);
    // precise failure reason
    const leaky = shadowEffectsSuppressed(validCollection({ mode: "shadow" }));
    expect(failureOf(leaky)).toBe(
      "guard shadow_effects_suppressed does not hold: shadow evaluation neither suppresses live effects nor uses isolated test doubles",
    );
  });
});