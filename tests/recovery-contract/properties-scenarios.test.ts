// Purpose: scenario property tests for the recovery-contract corpus rows
// Responsibilities: unknown_nonidempotent_effect_never_retries, rollback_cannot_claim_external_undo,
//   compensation_has_own_failure_path, recovery_requires_postcheck — names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/recovery-contract/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  createRecoveryMachine,
  RECOVERY_TRANSITIONS,
} from "../../src/recovery-contract/machine";
import {
  compensationIsNewEffect,
  executeRollback,
} from "../../src/recovery-contract/invariants";
import { validAttempt, validCompensation } from "./fixtures";

describe("recovery-contract scenario properties", () => {
  it("Property test: all paths from effect_unknown + non-idempotent mutation to retry pass through successful reconciliation", () => {
    // non-idempotent mutation: mutating with idempotency NOT proven
    const failure = {
      failureKind: "effect_unknown",
      operationKey: "op-1",
      mutating: true,
      evidenceRefs: ["ev-f1"],
    };
    // without reconciliation_resolved the retry path is closed at execute_recovery
    for (const preconditions of [
      ["same_operation_key", "failure_evidence_present"],
      ["same_operation_key", "failure_evidence_present", "idempotency_proven_rejected"],
    ]) {
      const m = createRecoveryMachine(validAttempt({ operation: "retry", failure, preconditions }));
      m.fire("validate_recovery");
      expect(m.fire("execute_recovery").ok).toBe(false);
      expect(m.state).toBe("eligible");
    }
    // the only path to a retry executes is through successful reconciliation
    const reconciled = createRecoveryMachine(
      validAttempt({
        operation: "retry",
        failure,
        preconditions: ["same_operation_key", "failure_evidence_present", "reconciliation_resolved"],
      }),
    );
    reconciled.fire("validate_recovery");
    expect(reconciled.fire("execute_recovery").ok).toBe(true);
    expect(reconciled.state).toBe("executing");
  });

  it("TypeScript test: rollback result with external effects records residual effects unless compensation succeeds", () => {
    const external = ["ext-1", "ext-2"];
    // no compensation: every external effect is recorded as residual, never claimed undone
    const bare = executeRollback(external, null);
    expect(bare.ok).toBe(false);
    expect(bare.residualEffects).toEqual(["ext-1", "ext-2"]);
    expect(bare.claimsExternalUndo).toBe(false);
    // succeeding, valid compensation offsets the external effects — as a new effect, not an undo
    const compensated = executeRollback(external, validCompensation());
    expect(compensated.ok).toBe(true);
    expect(compensated.residualEffects).toEqual([]);
    expect(compensated.claimsExternalUndo).toBe(false);
    expect(compensated.lineage.join(" ")).toMatch(/compensation applied as a new auditable effect/);
    // a compensation that is not a valid new effect does not offset anything
    const invalidComp = executeRollback(external, validCompensation({ observable: false }));
    expect(invalidComp.ok).toBe(false);
    expect(invalidComp.residualEffects).toEqual(["ext-1", "ext-2"]);
    // rollback with no external effects has nothing to offset
    const internal = executeRollback([], validCompensation());
    expect(internal.ok).toBe(true);
    expect(internal.residualEffects).toEqual([]);
  });

  it("Fault-injection test: compensation failure remains visible and cannot mark original operation recovered", () => {
    // inject: the compensating action itself fails
    const failed = validCompensation({ succeeded: false });
    expect(compensationIsNewEffect(failed).ok).toBe(true);
    const outcome = executeRollback(["ext-1"], failed);
    expect(outcome.ok).toBe(false);
    expect(outcome.residualEffects).toEqual(["ext-1"]);
    // the compensation failure remains visible in the lineage — it is not swallowed
    expect(outcome.lineage.join(" ")).toMatch(/compensation failed: failure remains visible in lineage/);
    // wired into the machine: the residual effect fails the declared postcheck, so the
    // original operation cannot be marked recovered
    const m = createRecoveryMachine(validAttempt({ operation: "rollback" }));
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    m.recordPostchecks({ "post: result matches authoritative state": false });
    m.fire("preserve_failed_recovery");
    expect(m.state).toBe("unresolved");
    expect(m.fire("accept_recovery").ok).toBe(false);
    expect(m.state).not.toBe("recovered");
  });

  it("Model test: no recovery path reaches recovered without post-condition evaluation", () => {
    // the only transition into recovered is accept_recovery, and its guard requires evaluation
    const intoRecovered = RECOVERY_TRANSITIONS.filter((t) => t.to === "recovered");
    expect(intoRecovered).toHaveLength(1);
    expect(intoRecovered[0]!.id).toBe("accept_recovery");
    // a machine driven to verifying without recorded postchecks cannot be accepted
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    const r = m.fire("accept_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard recovery_verification_required does not hold: post-recovery invariants not evaluated",
    );
    expect(m.state).toBe("verifying");
    // once every declared postcheck is evaluated and passes, recovered is reachable
    m.recordPostchecks({ "post: result matches authoritative state": true });
    expect(m.fire("accept_recovery").ok).toBe(true);
    expect(m.state).toBe("recovered");
  });
});