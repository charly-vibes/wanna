// Purpose: property test for the pre_postconditions_declared constraint
// Responsibilities: p_pre_postconditions_declared as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-pre-postconditions-declared-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { prePostconditionsDeclared, CONDITION_CATEGORIES } from "../../src/capability-contract/invariants";
import type { PrePostconditions } from "../../src/capability-contract/types";
import { validConditions } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant pre_postconditions_declared at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a canonical declaration passes
      const canonical = validConditions();
      expect(prePostconditionsDeclared(canonical).ok).toBe(true);
      // omitting any one category is named precisely — including the typed unmet-condition result
      for (const { field, label } of CONDITION_CATEGORIES) {
        const partial = {
          ...canonical,
          [field]: typeof canonical[field as keyof PrePostconditions] === "string" ? "" : [],
        };
        const r = prePostconditionsDeclared(partial as PrePostconditions);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard pre_postconditions_declared does not hold: capability declaration does not declare ${label}`,
        );
      }
      // edge case: declaring conditions without a typed unmet-condition result is incomplete
      expect(prePostconditionsDeclared(validConditions({ unmetConditionResult: "" })).ok).toBe(false);
    },
  );
});