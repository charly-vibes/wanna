// Purpose: property test for the effects_declared constraint
// Responsibilities: p_effects_declared as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-effects-declared-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { effectsDeclared, EFFECT_CATEGORIES } from "../../src/capability-contract/invariants";
import type { EffectDeclaration } from "../../src/capability-contract/types";
import { validEffects } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant effects_declared at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a canonical declaration passes — reversible and compensatable effects both declare
      expect(effectsDeclared(validEffects()).ok).toBe(true);
      expect(effectsDeclared(validEffects({ reversibility: "reversible" })).ok).toBe(true);
      // omitting any one category is named precisely
      for (const { field, label } of EFFECT_CATEGORIES) {
        const partial = {
          ...validEffects(),
          [field]: typeof validEffects()[field as keyof EffectDeclaration] === "string" ? "" : [],
        };
        const r = effectsDeclared(partial as EffectDeclaration);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard effects_declared does not hold: capability declaration does not declare ${label}`,
        );
      }
      // edge case: irreversible-but-uncompensated silence is still an omitted declaration
      expect(effectsDeclared(validEffects({ idempotency: "" })).ok).toBe(false);
    },
  );
});