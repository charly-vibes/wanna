// Purpose: property test for the implementation_not_contract constraint
// Responsibilities: p_implementation_not_contract as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-implementation-not-contract-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { implementationNotContract } from "../../src/capability-contract/invariants";
import { validContract } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant implementation_not_contract at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a contract whose declarations are independent of the implementation passes
      const canonical = validContract();
      expect(implementationNotContract(canonical).ok).toBe(true);
      // edge case: an implementation module path presented as a schema is the contract leak
      const leaked = validContract({
        io: { ...canonical.io, inputSchema: "src/caps/spec-lint.ts" },
      });
      const r = implementationNotContract(leaked);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(
        'guard implementation_not_contract does not hold: implementation source "src/caps/spec-lint.ts" is presented as the public capability contract',
      );
      // edge case: a provider-specific prompt as the only declaration is not a contract
      const promptOnly = validContract({
        implementation: { kind: "provider-prompt", reference: "prompts/summarize.txt" },
        io: { ...canonical.io, inputSchema: "", outputSchema: "" },
      });
      const p = implementationNotContract(promptOnly);
      expect(p.ok).toBe(false);
      expect(p.reason).toBe(
        "guard implementation_not_contract does not hold: a provider-specific prompt is the only declaration — implementation code or provider-specific prompts are not the public capability contract",
      );
      // edge case: a provider prompt alongside a declared contract is allowed — the contract is the surface
      const promptWithContract = validContract({
        implementation: { kind: "provider-prompt", reference: "prompts/summarize.txt" },
      });
      expect(implementationNotContract(promptWithContract).ok).toBe(true);
    },
  );
});