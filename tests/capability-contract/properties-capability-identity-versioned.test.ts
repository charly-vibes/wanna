// Purpose: property test for the capability_identity_versioned constraint
// Responsibilities: p_capability_identity_versioned as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-capability-identity-versioned-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { capabilityIdentityVersioned, IDENTITY_CATEGORIES } from "../../src/capability-contract/invariants";
import { validContract } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant capability_identity_versioned at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a canonical identity declares every category and passes
      const canonical = validContract().identity;
      expect(capabilityIdentityVersioned(canonical).ok).toBe(true);
      // omitting any one category is named precisely
      for (const { field, label } of IDENTITY_CATEGORIES) {
        const partial = { ...canonical, [field]: "" };
        const r = capabilityIdentityVersioned(partial);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard capability_identity_versioned does not hold: capability identity does not declare ${label}`,
        );
      }
      // edge case: a non-semantic version string is named precisely
      const badSemver = { ...canonical, semanticVersion: "1.2" };
      const semver = capabilityIdentityVersioned(badSemver);
      expect(semver.ok).toBe(false);
      expect(semver.reason).toBe(
        'guard capability_identity_versioned does not hold: capability identity declares "1.2" as the semantic version, which is not a semantic version',
      );
      // edge case: the revision identifier must be present even when the semver is valid
      expect(capabilityIdentityVersioned({ ...canonical, revision: "" }).ok).toBe(false);
    },
  );
});