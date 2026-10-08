// Purpose: property test for the inputs_outputs_typed constraint
// Responsibilities: p_inputs_outputs_typed as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-inputs-outputs-typed-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createCapabilityMachine } from "../../src/capability-contract/machine";
import { inputsOutputsTyped, IO_CATEGORIES } from "../../src/capability-contract/invariants";
import type { SchemaDeclaration } from "../../src/capability-contract/types";
import { validContract, validIo } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant inputs_outputs_typed at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // a typed declaration passes and authorizes validation at the trust boundary
      const canonical = validIo();
      expect(inputsOutputsTyped(canonical).ok).toBe(true);
      const m = createCapabilityMachine(validContract());
      expect(m.fire("validate_capability", undefined).ok).toBe(true);
      expect(m.state).toBe("validated");
      // omitting any one category is named precisely
      for (const { field, label } of IO_CATEGORIES) {
        const partial = { ...canonical, [field]: typeof canonical[field as keyof SchemaDeclaration] === "string" ? "" : [] };
        const r = inputsOutputsTyped(partial as SchemaDeclaration);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard inputs_outputs_typed does not hold: capability declaration does not declare ${label}`,
        );
      }
      // edge case: the untyped capability is rejected, never silently validated
      const untyped = createCapabilityMachine(
        validContract({ io: validIo({ validationRules: [] }) }),
      );
      expect(untyped.fire("validate_capability", undefined).ok).toBe(false);
      expect(untyped.fire("reject_capability", undefined).ok).toBe(true);
      expect(untyped.state).toBe("rejected");
    },
  );
});