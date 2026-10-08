// Purpose: invariants for the recovery-contract machine
// Responsibilities: the eight corpus constraints as precise-check functions, rollback/compensation semantics, evidence preservation
// Rationale: each invariant returns an exact failure reason so negative tests can assert it verbatim
import type {
  Check,
  CompensationRecord,
  RecoveryAttempt,
  RecoveryEvent,
  RollbackOutcome,
} from "./types";
import { RECOVERY_OPERATIONS } from "./types";

const TYPED = "guard recovery_operation_typed does not hold: ";
const RETRY_SAFETY = "guard retry_requires_safety does not hold: ";
const VERIFICATION = "guard recovery_verification_required does not hold: ";
const USER_CONTROL =
  "guard user_control_available does not hold: human-judgment recovery without exposed safe abort and escalation alternatives";
const EFFECT_UNKNOWN_RETRY =
  "effect_unknown failure cannot retry a non-idempotent mutation before reconciliation resolves effect state";
const MUTATING_RETRY_UNSAFE =
  "mutating retry without proven idempotency or reconciliation proving the prior effect did not occur";

export function recoveryOperationTyped(attempt: RecoveryAttempt): Check {
  if (attempt.operation === undefined) {
    return { ok: false, reason: `${TYPED}missing recovery operation` };
  }
  if (!(RECOVERY_OPERATIONS as readonly string[]).includes(attempt.operation)) {
    return { ok: false, reason: `${TYPED}unsupported recovery operation` };
  }
  if (attempt.preconditions.length === 0) {
    return { ok: false, reason: `${TYPED}no preconditions declared` };
  }
  if (attempt.operationKey !== attempt.failure.operationKey) {
    return { ok: false, reason: `${TYPED}attempt key does not match failure key` };
  }
  if (attempt.failure.evidenceRefs.length === 0) {
    return { ok: false, reason: `${TYPED}failure carries no evidence` };
  }
  return { ok: true };
}

export function reconcilePrecedesUnknownRetry(attempt: RecoveryAttempt): Check {
  if (attempt.failure.failureKind !== "effect_unknown") return { ok: true };
  if (!attempt.failure.mutating) return { ok: true };
  if (attempt.preconditions.includes("idempotency_proven")) return { ok: true };
  if (attempt.preconditions.includes("reconciliation_resolved")) return { ok: true };
  return { ok: false, reason: `${RETRY_SAFETY}${EFFECT_UNKNOWN_RETRY}` };
}

export function retryRequiresSafety(attempt: RecoveryAttempt): Check {
  if (attempt.operation !== "retry") return { ok: true };
  if (!attempt.failure.mutating) return { ok: true };
  if (attempt.preconditions.includes("idempotency_proven")) return { ok: true };
  if (attempt.preconditions.includes("reconciliation_resolved")) return { ok: true };
  if (attempt.failure.failureKind === "effect_unknown") {
    return { ok: false, reason: `${RETRY_SAFETY}${EFFECT_UNKNOWN_RETRY}` };
  }
  return { ok: false, reason: `${RETRY_SAFETY}${MUTATING_RETRY_UNSAFE}` };
}

export function postchecksDeclared(attempt: RecoveryAttempt): Check {
  if (attempt.postcheckInvariants.length === 0) {
    return {
      ok: false,
      reason: `${VERIFICATION}no post-recovery invariants declared`,
    };
  }
  return { ok: true };
}

export function postchecksSatisfied(
  attempt: RecoveryAttempt,
  postchecks: Readonly<Record<string, boolean>> | null,
): Check {
  if (postchecks === null) {
    return {
      ok: false,
      reason: `${VERIFICATION}post-recovery invariants not evaluated`,
    };
  }
  for (const name of attempt.postcheckInvariants) {
    if (!(name in postchecks)) {
      return {
        ok: false,
        reason: `${VERIFICATION}post-recovery invariants not evaluated`,
      };
    }
    if (!postchecks[name]) {
      return {
        ok: false,
        reason: `${VERIFICATION}postcheck invariant failed`,
      };
    }
  }
  return { ok: true };
}

export function userControlAvailable(attempt: RecoveryAttempt): Check {
  if (!attempt.requiresHumanJudgment) return { ok: true };
  const alternatives = attempt.alternatives ?? [];
  const safe =
    alternatives.includes("abort") && alternatives.includes("escalate");
  if (safe && alternatives.length >= 2) return { ok: true };
  return { ok: false, reason: USER_CONTROL };
}

export function compensationIsNewEffect(record: CompensationRecord): Check {
  if (record.authorizationRef.length === 0) {
    return {
      ok: false,
      reason: "guard compensation_is_new_effect does not hold: compensating action is not authorized",
    };
  }
  if (!record.observable) {
    return {
      ok: false,
      reason: "guard compensation_is_new_effect does not hold: compensating action is not observable",
    };
  }
  if (!record.failurePathDeclared) {
    return {
      ok: false,
      reason: "guard compensation_is_new_effect does not hold: compensating action declares no failure path",
    };
  }
  if (record.auditRefs.length === 0) {
    return {
      ok: false,
      reason: "guard compensation_is_new_effect does not hold: compensating action is not auditable",
    };
  }
  return { ok: true };
}

export function executeRollback(
  externalEffectIds: readonly string[],
  compensation: CompensationRecord | null,
): RollbackOutcome {
  if (externalEffectIds.length === 0) {
    return {
      ok: true,
      residualEffects: [],
      claimsExternalUndo: false,
      lineage: ["rollback completed with no external effects to offset"],
    };
  }
  if (compensation !== null && compensationSucceeds(compensation)) {
    return {
      ok: true,
      residualEffects: [],
      claimsExternalUndo: false,
      lineage: [
        "compensation applied as a new auditable effect",
        "external effects offset by compensation",
      ],
    };
  }
  return failedRollback(externalEffectIds, compensation);
}

function compensationSucceeds(compensation: CompensationRecord): boolean {
  return compensation.succeeded && compensationIsNewEffect(compensation).ok;
}

function failedRollback(
  externalEffectIds: readonly string[],
  compensation: CompensationRecord | null,
): RollbackOutcome {
  const lineage = [
    "residual external effects recorded; internal rollback does not undo external effects",
  ];
  if (compensation !== null && !compensation.succeeded) {
    lineage.push("compensation failed: failure remains visible in lineage");
  }
  if (compensation !== null && !compensationIsNewEffect(compensation).ok) {
    lineage.push("compensation rejected: not a valid new effect");
  }
  return {
    ok: false,
    residualEffects: [...externalEffectIds],
    claimsExternalUndo: false,
    lineage,
  };
}

export function evidencePreserved(
  log: readonly RecoveryEvent[],
  originalRefs: readonly string[],
): Check {
  const present = new Set<string>();
  let previousSeq = 0;
  for (const event of log) {
    if (event.seq <= previousSeq) {
      return {
        ok: false,
        reason: "guard recovery_preserves_evidence does not hold: evidence lineage sequence is not monotone",
      };
    }
    previousSeq = event.seq;
    for (const ref of event.refs) present.add(ref);
  }
  for (const ref of originalRefs) {
    if (!present.has(ref)) {
      return {
        ok: false,
        reason: "guard recovery_preserves_evidence does not hold: original failure evidence was deleted",
      };
    }
  }
  return { ok: true };
}