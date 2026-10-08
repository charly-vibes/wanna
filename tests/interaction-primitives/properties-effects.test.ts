// Purpose: effect/provenance property tests for the interaction-primitives gate
// Responsibilities: failure-paths-are-typed and provenance-distinguishes-evidence-strength corpus properties; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-primitives/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  failureAndRecoveryFirstClass,
  evidenceStrengthExplicit,
  EVIDENCE_CLASSES,
} from "../../src/interaction-primitives/invariants";
import { validRevision } from "./fixtures";
import type { PrimitiveRevision } from "../../src/interaction-primitives/types";

describe("interaction-primitives properties: effects", () => {
  it("Graph test: declared mutating operations have typed failure and recovery paths", () => {
    // the canonical revision: every mutating operation carries a typed path
    expect(failureAndRecoveryFirstClass(validRevision()).ok).toBe(true);

    // a declared mutating operation without a failure path is a violation,
    // named precisely — not a generic exception
    const noPath = validRevision({ mutatingOperations: ["deploy_revision", "ship_it"] });
    expect(failureAndRecoveryFirstClass(noPath).reason).toBe(
      'mutating operation "ship_it" has no typed failure path',
    );

    // a failure path without a typed failure is a violation
    const untyped = validRevision({
      failurePaths: [
        {
          operation: "deploy_revision",
          failureType: "",
          effectCertainty: "at_most_once",
          recovery: "rollback",
          recoveryPreconditions: ["previous revision still deployed"],
        },
      ],
    });
    expect(failureAndRecoveryFirstClass(untyped).reason).toBe(
      'failure path for "deploy_revision" declares no failure type',
    );

    // a recovery action without preconditions is a violation
    const unconditional = validRevision({
      failurePaths: [
        {
          operation: "deploy_revision",
          failureType: "deployment_failed",
          effectCertainty: "at_most_once",
          recovery: "rollback",
          recoveryPreconditions: [],
        },
      ],
    });
    expect(failureAndRecoveryFirstClass(unconditional).reason).toBe(
      'failure path for "deploy_revision" declares recovery "rollback" without preconditions',
    );

    // a failure path for an undeclared operation breaks graph consistency
    const ghost = validRevision({
      failurePaths: [
        {
          operation: "ghost_op",
          failureType: "deployment_failed",
          effectCertainty: "at_most_once",
          recovery: "rollback",
          recoveryPreconditions: ["previous revision still deployed"],
        },
      ],
    }) as PrimitiveRevision;
    expect(failureAndRecoveryFirstClass(ghost).reason).toBe(
      'failure path references undeclared mutating operation "ghost_op"',
    );
  });

  it("Schema test: imported research claims declare evidence class instead of becoming silently normative", () => {
    // the canonical revision: every claim declares an evidence class
    expect(evidenceStrengthExplicit(validRevision()).ok).toBe(true);

    // a claim without an evidence class would become silently normative — rejected, named precisely
    const silent = validRevision({ provenance: [{ claimId: "e1", evidenceClass: undefined as never }] });
    expect(evidenceStrengthExplicit(silent).reason).toBe(
      'provenance record "e1" declares no evidence class and would become silently normative',
    );

    // an unknown evidence class is rejected, named precisely
    const unknown = validRevision({ provenance: [{ claimId: "e1", evidenceClass: "folklore" as never }] });
    expect(evidenceStrengthExplicit(unknown).reason).toBe(
      'provenance record "e1" declares unknown evidence class "folklore" — evidence strength is not explicit',
    );

    // the five strength classes remain distinguishable: distinct literals, no collapse
    expect(EVIDENCE_CLASSES).toHaveLength(5);
    expect(new Set(EVIDENCE_CLASSES).size).toBe(5);
    for (const cls of EVIDENCE_CLASSES) {
      const revision = validRevision({ provenance: [{ claimId: "e1", evidenceClass: cls }] });
      expect(evidenceStrengthExplicit(revision).ok).toBe(true);
    }
  });
});