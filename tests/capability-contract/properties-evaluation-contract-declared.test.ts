// Purpose: property test for the evaluation_contract_declared constraint
// Responsibilities: p_evaluation_contract_declared as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/capability-contract/p-evaluation-contract-declared-holds.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createCapabilityMachine } from "../../src/capability-contract/machine";
import { evaluationContractDeclared, EVALUATION_CATEGORIES } from "../../src/capability-contract/invariants";
import type { EvaluationContract } from "../../src/capability-contract/types";
import { validContract, validEvaluation } from "./fixtures";

describe("capability-contract properties", () => {
  it(
    "TypeScript conformance test: assert invariant evaluation_contract_declared at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // goal checks and safety invariants are declared separately, each with its failure behavior
      const canonical = validEvaluation();
      expect(evaluationContractDeclared(canonical).ok).toBe(true);
      const m = createCapabilityMachine(validContract());
      m.fire("validate_capability", undefined);
      expect(m.fire("register_capability", undefined).ok).toBe(true);
      expect(m.state).toBe("registered");
      // omitting any one category is named precisely
      for (const { field, label } of EVALUATION_CATEGORIES) {
        const partial = {
          ...canonical,
          [field]: typeof canonical[field as keyof EvaluationContract] === "string" ? "" : [],
        };
        const r = evaluationContractDeclared(partial as EvaluationContract);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard evaluation_contract_declared does not hold: capability declaration does not declare ${label}`,
        );
      }
      // edge case: goal checks without their failure behavior do not authorize registration
      const incomplete = createCapabilityMachine(
        validContract({ evaluation: validEvaluation({ goalCheckFailureBehavior: "" }) }),
      );
      incomplete.fire("validate_capability", undefined);
      expect(incomplete.fire("register_capability", undefined).ok).toBe(false);
      expect(incomplete.state).toBe("validated");
    },
  );
});