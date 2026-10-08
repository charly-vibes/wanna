// Purpose: evaluation-telemetry state machine
// Responsibilities: the five transitions (evaluate, mark-eligible, promote, detect-degradation, rollback) with their guards
// Rationale: telemetry informs improvement but never authorizes policy changes; rollback is explicit, never silent
import type {
  Check,
  DegradationSignal,
  EvaluationRecord,
  EvaluationState,
  EvaluationTransitionId,
  TransitionPayloadMap,
  TransitionResult,
} from "./types";
import {
  metricsHaveDefinitions,
  metricsVersioned,
  promotionRequiresEvidence,
  regressionTriggersFallback,
  rollbackAllowed,
} from "./invariants";

export interface TransitionRow {
  readonly id: EvaluationTransitionId;
  readonly from: EvaluationState;
  readonly to: EvaluationState;
}

export const EVALUATION_TRANSITIONS: readonly TransitionRow[] = [
  { id: "evaluate_candidate", from: "collecting", to: "evaluated" },
  { id: "mark_eligible", from: "evaluated", to: "eligible" },
  { id: "promote_candidate", from: "eligible", to: "promoted" },
  { id: "detect_degradation", from: "promoted", to: "degraded" },
  { id: "rollback_candidate", from: "degraded", to: "rolled_back" },
];

export interface RecordedTransition {
  readonly id: EvaluationTransitionId;
  readonly from: EvaluationState;
  readonly to: EvaluationState;
}

export interface EvaluationPipeline {
  readonly record: EvaluationRecord;
  readonly state: EvaluationState;
  readonly transitionLog: readonly RecordedTransition[];
  readonly failureReason: string | null;
  fire<P extends EvaluationTransitionId>(id: P, payload: TransitionPayloadMap[P]): TransitionResult;
}

interface Internals {
  state: EvaluationState;
  record: EvaluationRecord;
  log: RecordedTransition[];
  failureReason: string | null;
}

function guardHolds(
  record: EvaluationRecord,
  id: EvaluationTransitionId,
  payload: TransitionPayloadMap[EvaluationTransitionId],
): Check {
  if (id === "evaluate_candidate") return metricsHaveDefinitions(record.metrics);
  if (id === "mark_eligible") return promotionRequiresEvidence(record);
  if (id === "promote_candidate") return metricsVersioned(record);
  if (id === "detect_degradation") {
    return regressionTriggersFallback(payload as DegradationSignal, record.recovery);
  }
  return rollbackAllowed(record.recovery);
}

function refuse(internals: Internals, reason: string): TransitionResult {
  internals.failureReason = reason;
  return { ok: false, reason };
}

function applyEffect(internals: Internals, id: EvaluationTransitionId): void {
  const row = EVALUATION_TRANSITIONS.find((r) => r.id === id) as TransitionRow;
  internals.state = row.to;
  internals.log = [...internals.log, { id: row.id, from: row.from, to: row.to }];
  internals.failureReason = null;
}

function fireTransition(
  internals: Internals,
  id: EvaluationTransitionId,
  payload: TransitionPayloadMap[EvaluationTransitionId],
): TransitionResult {
  const row = EVALUATION_TRANSITIONS.find((r) => r.id === id);
  if (!row) return refuse(internals, `unknown transition ${id}`);
  if (internals.state !== row.from) {
    return refuse(internals, `transition ${id} cannot fire from state ${internals.state}`);
  }
  const guard = guardHolds(internals.record, id, payload);
  if (!guard.ok) return refuse(internals, guard.reason);
  applyEffect(internals, id);
  return { ok: true };
}

function makeMachine(internals: Internals): EvaluationPipeline {
  return {
    get record() {
      return internals.record;
    },
    get state() {
      return internals.state;
    },
    get transitionLog() {
      return internals.log;
    },
    get failureReason() {
      return internals.failureReason;
    },
    fire<P extends EvaluationTransitionId>(id: P, payload: TransitionPayloadMap[P]): TransitionResult {
      return fireTransition(internals, id, payload);
    },
  };
}

export function createEvaluationPipeline(record: EvaluationRecord): EvaluationPipeline {
  return makeMachine({
    state: "collecting",
    record,
    log: [],
    failureReason: null,
  });
}