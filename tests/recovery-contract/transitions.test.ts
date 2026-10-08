// Purpose: transition tests for the recovery-contract model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons
import { describe, it, expect } from "vitest";
import { createRecoveryMachine } from "../../src/recovery-contract/machine";
import { validAttempt } from "./fixtures";

describe("recovery-contract transitions", () => {
  it("validate_recovery moves proposed → eligible when recovery_operation_typed holds", () => {
    const m = createRecoveryMachine(validAttempt());
    const r = m.fire("validate_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("eligible");
  });

  it("block_unsafe_recovery moves proposed → blocked when recovery_operation_typed fails, recording why", () => {
    const m = createRecoveryMachine(validAttempt({ operation: "undo" }));
    const r = m.fire("block_unsafe_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("blocked");
    expect(m.blockedReason).toBe(
      "guard recovery_operation_typed does not hold: unsupported recovery operation",
    );
  });

  it("block_unsafe_recovery refuses to fire when the attempt is typed and eligible", () => {
    const m = createRecoveryMachine(validAttempt());
    const r = m.fire("block_unsafe_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "block_unsafe_recovery requires recovery_operation_typed to fail — the attempt is eligible, not blocked",
    );
    expect(m.state).toBe("proposed");
  });

  it("execute_recovery moves eligible → executing when retry_requires_safety holds", () => {
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    const r = m.fire("execute_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("executing");
  });

  it("execute_recovery refuses a mutating retry without proven idempotency or reconciliation, naming the precise reason", () => {
    const m = createRecoveryMachine(
      validAttempt({
        failure: {
          failureKind: "effect_unknown",
          operationKey: "op-1",
          mutating: true,
          evidenceRefs: ["ev-f1"],
        },
        preconditions: ["same_operation_key", "failure_evidence_present"],
      }),
    );
    m.fire("validate_recovery");
    const r = m.fire("execute_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard retry_requires_safety does not hold: effect_unknown failure cannot retry a non-idempotent mutation before reconciliation resolves effect state",
    );
    expect(m.state).toBe("eligible");
  });

  it("verify_recovery moves executing → verifying when post-recovery invariants are declared", () => {
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    const r = m.fire("verify_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("verifying");
  });

  it("verify_recovery refuses to advance when no post-recovery invariants are declared", () => {
    const m = createRecoveryMachine(validAttempt({ postcheckInvariants: [] }));
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    const r = m.fire("verify_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard recovery_verification_required does not hold: no post-recovery invariants declared",
    );
    expect(m.state).toBe("executing");
  });

  it("accept_recovery moves verifying → recovered when all declared postchecks pass", () => {
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    const recorded = m.recordPostchecks({
      "post: result matches authoritative state": true,
    });
    expect(recorded.ok).toBe(true);
    const r = m.fire("accept_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("recovered");
  });

  it("preserve_failed_recovery moves verifying → unresolved when a declared postcheck fails", () => {
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    m.recordPostchecks({
      "post: result matches authoritative state": false,
    });
    const r = m.fire("preserve_failed_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("unresolved");
  });

  it("preserve_failed_recovery refuses to fire when recovery_verification_required holds", () => {
    const m = createRecoveryMachine(validAttempt());
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    m.recordPostchecks({
      "post: result matches authoritative state": true,
    });
    const r = m.fire("preserve_failed_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "preserve_failed_recovery requires recovery_verification_required to fail — declared postchecks pass",
    );
    expect(m.state).toBe("verifying");
  });

  it("escalate_recovery moves unresolved → escalated when safe alternatives are exposed", () => {
    const m = createRecoveryMachine(
      validAttempt({
        requiresHumanJudgment: true,
        alternatives: ["retry_with_new_evidence", "abort", "escalate"],
      }),
    );
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    m.recordPostchecks({
      "post: result matches authoritative state": false,
    });
    m.fire("preserve_failed_recovery");
    const r = m.fire("escalate_recovery");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("escalated");
  });

  it("escalate_recovery refuses to fire when human judgment has no abort/escalation alternatives", () => {
    const m = createRecoveryMachine(
      validAttempt({ requiresHumanJudgment: true, alternatives: ["retry"] }),
    );
    m.fire("validate_recovery");
    m.fire("execute_recovery");
    m.fire("verify_recovery");
    m.recordPostchecks({
      "post: result matches authoritative state": false,
    });
    m.fire("preserve_failed_recovery");
    const r = m.fire("escalate_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard user_control_available does not hold: human-judgment recovery without exposed safe abort and escalation alternatives",
    );
    expect(m.state).toBe("unresolved");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createRecoveryMachine(validAttempt());
    // accept_recovery starts at verifying, not proposed
    const r = m.fire("accept_recovery");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "transition accept_recovery cannot fire from state proposed",
    );
    expect(m.state).toBe("proposed");
  });

  it("recordPostchecks is only accepted while verifying", () => {
    const m = createRecoveryMachine(validAttempt());
    const r = m.recordPostchecks({
      "post: result matches authoritative state": true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "post-condition evaluation is only recorded while verifying (state proposed)",
    );
    expect(m.state).toBe("proposed");
  });
});