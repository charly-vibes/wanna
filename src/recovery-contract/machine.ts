// Purpose: recovery-contract state machine
// Responsibilities: the seven transitions (validate, block, execute, verify, accept, preserve-failed, escalate) with their guards
// Rationale: `recovered` is reachable only through evaluated postchecks; unsafe attempts are blocked, not silently repaired
import type {
  RecoveryAttempt,
  RecoveryEvent,
  RecoveryState,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  postchecksDeclared,
  postchecksSatisfied,
  recoveryOperationTyped,
  retryRequiresSafety,
  userControlAvailable,
} from "./invariants";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: RecoveryState;
  readonly to: RecoveryState;
}

export const RECOVERY_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_recovery", from: "proposed", to: "eligible" },
  { id: "block_unsafe_recovery", from: "proposed", to: "blocked" },
  { id: "execute_recovery", from: "eligible", to: "executing" },
  { id: "verify_recovery", from: "executing", to: "verifying" },
  { id: "accept_recovery", from: "verifying", to: "recovered" },
  { id: "preserve_failed_recovery", from: "verifying", to: "unresolved" },
  { id: "escalate_recovery", from: "unresolved", to: "escalated" },
];

export interface RecoveryMachine {
  readonly attempt: RecoveryAttempt;
  readonly state: RecoveryState;
  readonly evidenceLog: readonly RecoveryEvent[];
  readonly postchecks: Readonly<Record<string, boolean>> | null;
  readonly blockedReason: string | null;
  fire(id: TransitionId): TransitionResult;
  recordPostchecks(results: Readonly<Record<string, boolean>>): TransitionResult;
}

interface Internals {
  state: RecoveryState;
  attempt: RecoveryAttempt;
  evidenceLog: RecoveryEvent[];
  postchecks: Record<string, boolean> | null;
  blockedReason: string | null;
  seq: number;
}

function blockGuard(attempt: RecoveryAttempt): TransitionResult {
  const typed = recoveryOperationTyped(attempt);
  return typed.ok
    ? {
        ok: false,
        reason:
          "block_unsafe_recovery requires recovery_operation_typed to fail — the attempt is eligible, not blocked",
      }
    : { ok: true };
}

function preserveGuard(
  attempt: RecoveryAttempt,
  postchecks: Readonly<Record<string, boolean>> | null,
): TransitionResult {
  const satisfied = postchecksSatisfied(attempt, postchecks);
  return satisfied.ok
    ? {
        ok: false,
        reason:
          "preserve_failed_recovery requires recovery_verification_required to fail — declared postchecks pass",
      }
    : { ok: true };
}

function guardHolds(internals: Internals, id: TransitionId): TransitionResult {
  if (id === "validate_recovery") return recoveryOperationTyped(internals.attempt);
  if (id === "block_unsafe_recovery") return blockGuard(internals.attempt);
  if (id === "execute_recovery") return retryRequiresSafety(internals.attempt);
  if (id === "verify_recovery") return postchecksDeclared(internals.attempt);
  if (id === "accept_recovery") {
    return postchecksSatisfied(internals.attempt, internals.postchecks);
  }
  if (id === "preserve_failed_recovery") {
    return preserveGuard(internals.attempt, internals.postchecks);
  }
  return userControlAvailable(internals.attempt);
}

function appendEvent(
  internals: Internals,
  kind: string,
  detail: string,
  refs: readonly string[] = [],
): void {
  internals.seq += 1;
  internals.evidenceLog.push({ seq: internals.seq, kind, detail, refs });
}

function initialStateEvents(attempt: RecoveryAttempt): RecoveryEvent[] {
  const events: RecoveryEvent[] = [];
  let seq = 0;
  for (const ref of attempt.failure.evidenceRefs) {
    seq += 1;
    events.push({
      seq,
      kind: "failure_evidence",
      detail: "typed failure attached",
      refs: [ref],
    });
  }
  return events;
}

function fireTransition(internals: Internals, id: TransitionId): TransitionResult {
  const row = RECOVERY_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return {
      ok: false,
      reason: `transition ${id} cannot fire from state ${internals.state}`,
    };
  }
  const guard = guardHolds(internals, id);
  if (!guard.ok) return guard;
  applyEffect(internals, id, row.to);
  return { ok: true };
}

function applyEffect(internals: Internals, id: TransitionId, to: RecoveryState): void {
  internals.state = to;
  if (id === "block_unsafe_recovery") {
    const typed = recoveryOperationTyped(internals.attempt);
    internals.blockedReason = typed.reason ?? "unsafe recovery attempt";
  }
  appendEvent(internals, "transition", `${id}: → ${to}`);
}

function recordPostcheckResults(
  internals: Internals,
  results: Readonly<Record<string, boolean>>,
): TransitionResult {
  if (internals.state !== "verifying") {
    return {
      ok: false,
      reason: `post-condition evaluation is only recorded while verifying (state ${internals.state})`,
    };
  }
  internals.postchecks = { ...results };
  appendEvent(
    internals,
    "postcheck",
    "post-condition evaluation recorded",
    internals.attempt.postcheckInvariants,
  );
  return { ok: true };
}

function makeMachine(internals: Internals): RecoveryMachine {
  return {
    get attempt() {
      return internals.attempt;
    },
    get state() {
      return internals.state;
    },
    get evidenceLog() {
      return internals.evidenceLog;
    },
    get postchecks() {
      return internals.postchecks;
    },
    get blockedReason() {
      return internals.blockedReason;
    },
    fire: (id) => fireTransition(internals, id),
    recordPostchecks: (results) => recordPostcheckResults(internals, results),
  };
}

export function createRecoveryMachine(attempt: RecoveryAttempt): RecoveryMachine {
  const internals: Internals = {
    state: "proposed",
    attempt,
    evidenceLog: initialStateEvents(attempt),
    postchecks: null,
    blockedReason: null,
    seq: attempt.failure.evidenceRefs.length,
  };
  return makeMachine(internals);
}