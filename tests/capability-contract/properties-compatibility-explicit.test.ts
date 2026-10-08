// Purpose: property test for the compatibility_explicit constraint
// Responsibilities: p_compatibility_explicit as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-compatibility-explicit-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createCapabilityMachine } from "../../src/capability-contract/machine";
import { compatibilityExplicit } from "../../src/capability-contract/invariants";
import type { CompatibilityDecision } from "../../src/capability-contract/types";
import { validCompatibility, validContract } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant compatibility_explicit at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a canonical decision paired with a migration strategy passes and deprecates
      const canonical = validCompatibility();
      expect(compatibilityExplicit(canonical).ok).toBe(true);
      const m = createCapabilityMachine(validContract());
      m.fire("validate_capability", undefined);
      m.fire("register_capability", undefined);
      expect(m.fire("deprecate_capability", canonical).ok).toBe(true);
      expect(m.state).toBe("deprecated");
      expect(m.compatibility).toEqual(canonical);
      // edge case: no decision at all is named precisely
      const none = compatibilityExplicit(undefined);
      expect(none.ok).toBe(false);
      expect(none.reason).toBe("guard compatibility_explicit does not hold: no compatibility decision provided");
      // edge case: an empty decision string is not a compatibility decision
      const empty: CompatibilityDecision = { ...canonical, decision: "" };
      const e = compatibilityExplicit(empty);
      expect(e.ok).toBe(false);
      expect(e.reason).toBe(
        "guard compatibility_explicit does not hold: compatibility decision does not declare a compatibility decision",
      );
      // edge case: a decision without a migration strategy cannot deprecate
      const unpaired = validCompatibility({ migrationStrategy: "" });
      expect(compatibilityExplicit(unpaired).ok).toBe(false);
      const m2 = createCapabilityMachine(validContract());
      m2.fire("validate_capability", undefined);
      m2.fire("register_capability", undefined);
      expect(m2.fire("deprecate_capability", unpaired).ok).toBe(false);
      expect(m2.state).toBe("registered");
    },
  );
});