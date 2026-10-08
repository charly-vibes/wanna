// Purpose: invariant property tests for the recovery-contract corpus rows
// Responsibilities: p_recovery_operation_typed, p_retry_requires_safety,
//   p_recovery_preserves_evidence, p_user_control_available — names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/recovery-contract/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createRecoveryMachine } from "../../src/recovery-contract/machine";
import {
  evidencePreserved,
  retryRequiresSafety,
  recoveryOperationTyped,
  userControlAvailable,
} from "../../src/recovery-contract/invariants";
import { RECOVERY_OPERATIONS } from "../../src/recovery-contract/index";
import { validAttempt } from "./fixtures";

describe("recovery-contract invariant properties", () => {
  it("every recovery attempt names one supported recovery operation and its preconditions", () => {
    // each supported operation names itself plus declared preconditions and validates
    for (const operation of RECOVERY_OPERATIONS) {
      const attempt = validAttempt({ operation });
      expect(recoveryOperationTyped(attempt).ok).toBe(true);
      const m = createRecoveryMachine(attempt);
      expect(m.fire("validate_recovery").ok).toBe(true);
      expect(m.state).toBe("eligible");
    }
    // exactly one operation — no compound or missing name passes
    expect(recoveryOperationTyped(validAttempt({ operation: undefined })).reason).toBe(
      "guard recovery_operation_typed does not hold: missing recovery operation",
    );
    expect(recoveryOperationTyped(validAttempt({ operation: "undo" })).reason).toBe(
      "guard recovery_operation_typed does not hold: unsupported recovery operation",
    );
    expect(recoveryOperationTyped(validAttempt({ preconditions: [] })).reason).toBe(
      "guard recovery_operation_typed does not hold: no preconditions declared",
    );
    expect(
      recoveryOperationTyped(validAttempt({ operationKey: "op-other" })).reason,
    ).toBe(
      "guard recovery_operation_typed does not hold: attempt key does not match failure key",
    );
    expect(
      recoveryOperationTyped(
        validAttempt({ failure: { failureKind: "operation_failed", operationKey: "op-1", mutating: false, evidenceRefs: [] } }),
      ).reason,
    ).toBe(
      "guard recovery_operation_typed does not hold: failure carries no evidence",
    );
    // each violation is blocked, not silently repaired
    const m = createRecoveryMachine(validAttempt({ operation: "undo" }));
    m.fire("block_unsafe_recovery");
    expect(m.state).toBe("blocked");
  });

  it("retry of a mutating operation is permitted only when idempotency is proven for the same operation key or reconciliation proves the prior effect did not occur", () => {
    const mutating = {
      failureKind: "operation_failed",
      operationKey: "op-1",
      mutating: true,
      evidenceRefs: ["ev-f1"],
    };
    const pre = ["same_operation_key", "failure_evidence_present"];
    // idempotency proven for the same operation key permits the retry
    expect(
      retryRequiresSafety(validAttempt({ operation: "retry", failure: mutating, preconditions: [...pre, "idempotency_proven"] })).ok,
    ).toBe(true);
    // reconciliation proving the prior effect did not occur permits the retry
    expect(
      retryRequiresSafety(validAttempt({ operation: "retry", failure: mutating, preconditions: [...pre, "reconciliation_resolved"] })).ok,
    ).toBe(true);
    // neither: refused with the precise reason
    expect(
      retryRequiresSafety(validAttempt({ operation: "retry", failure: mutating, preconditions: pre })).reason,
    ).toBe(
      "guard retry_requires_safety does not hold: mutating retry without proven idempotency or reconciliation proving the prior effect did not occur",
    );
    // a non-mutating retry needs neither
    expect(retryRequiresSafety(validAttempt({ operation: "retry" })).ok).toBe(true);
    // the guard is about retry — other operations are not gated by it
    expect(retryRequiresSafety(validAttempt({ operation: "rollback", failure: mutating })).ok).toBe(true);
  });

  it("recovery never deletes the original failure/effect evidence; new recovery events append lineage", () => {
    const attempt = validAttempt({
      requiresHumanJudgment: true,
      alternatives: ["abort", "escalate"],
      postcheckInvariants: ["post: result matches authoritative state"],
    });
    const originalRefs = [...attempt.failure.evidenceRefs];
    const m = createRecoveryMachine(attempt);
    let previousLength = m.evidenceLog.length;
    // every step of a full successful recovery appends and never removes evidence
    for (const id of [
      "validate_recovery", "execute_recovery", "verify_recovery",
    ] as const) {
      expect(m.fire(id).ok).toBe(true);
      expect(m.evidenceLog.length).toBeGreaterThan(previousLength);
      previousLength = m.evidenceLog.length;
      expect(evidencePreserved(m.evidenceLog, originalRefs).ok).toBe(true);
    }
    m.recordPostchecks({ "post: result matches authoritative state": false });
    expect(m.evidenceLog.length).toBeGreaterThan(previousLength);
    m.fire("preserve_failed_recovery");
    m.fire("escalate_recovery");
    // the original failure evidence is still present at the end of the lineage
    expect(evidencePreserved(m.evidenceLog, originalRefs).ok).toBe(true);
    expect(evidencePreserved(m.evidenceLog, originalRefs).reason).toBeUndefined();
    // even a blocked attempt preserves its failure evidence
    const blocked = createRecoveryMachine(validAttempt({ operation: "undo" }));
    blocked.fire("block_unsafe_recovery");
    expect(evidencePreserved(blocked.evidenceLog, originalRefs).ok).toBe(true);
  });

  it("when recovery requires human judgment, the interaction exposes valid alternatives including safe abort/escalation rather than forcing a single repair path", () => {
    // alternatives including abort and escalate satisfy the guard
    expect(
      userControlAvailable(validAttempt({ requiresHumanJudgment: true, alternatives: ["abort", "escalate"] })).ok,
    ).toBe(true);
    expect(
      userControlAvailable(
        validAttempt({ requiresHumanJudgment: true, alternatives: ["retry_with_new_evidence", "abort", "escalate"] }),
      ).ok,
    ).toBe(true);
    // a single repair path with no safe abort/escalation fails, naming the reason
    expect(
      userControlAvailable(validAttempt({ requiresHumanJudgment: true, alternatives: ["retry"] })).reason,
    ).toBe(
      "guard user_control_available does not hold: human-judgment recovery without exposed safe abort and escalation alternatives",
    );
    expect(
      userControlAvailable(validAttempt({ requiresHumanJudgment: true, alternatives: ["retry", "escalate"] })).reason,
    ).toBe(
      "guard user_control_available does not hold: human-judgment recovery without exposed safe abort and escalation alternatives",
    );
    expect(
      userControlAvailable(validAttempt({ requiresHumanJudgment: true })).reason,
    ).toBe(
      "guard user_control_available does not hold: human-judgment recovery without exposed safe abort and escalation alternatives",
    );
    // no human judgment required: the guard holds without alternatives
    expect(userControlAvailable(validAttempt()).ok).toBe(true);
    // the machine enforces the same guard at escalate_recovery
    const forced = createRecoveryMachine(validAttempt({ requiresHumanJudgment: true, alternatives: ["retry"] }));
    forced.fire("validate_recovery");
    forced.fire("execute_recovery");
    forced.fire("verify_recovery");
    forced.recordPostchecks({ "post: result matches authoritative state": false });
    forced.fire("preserve_failed_recovery");
    expect(forced.fire("escalate_recovery").ok).toBe(false);
    expect(forced.state).toBe("unresolved");
  });
});