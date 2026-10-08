// Purpose: continuity-contract state machine
// Responsibilities: the eight transitions (checkpoint, suspend, begin-reorientation, reconcile, resume x2, handoff, abandon) with their guards
// Rationale: resumption reorients before consequential continuation; stale pending actions are reconciled, never silently committed
import type {
  Checkpoint,
  CheckpointScope,
  ContinuityState,
  ContinuityTask,
  ContinuityTransitionId,
  HandoffRecord,
  ReconciliationRecord,
  ResumeContext,
  RevisionQuery,
  SuspendPolicy,
  TransitionPayloadMap,
  TransitionResult,
} from "./types";
import {
  checkpointScopeExplicit,
  handoffPreservesOwnership,
  interruptedInputPreserved,
  reconcileChangedContext,
  resumeReorientsUser,
  stalePendingActionsReconciled,
} from "./invariants";

export interface TransitionRow {
  readonly id: ContinuityTransitionId;
  readonly from: ContinuityState;
  readonly to: ContinuityState;
}

export const CONTINUITY_TRANSITIONS: readonly TransitionRow[] = [
  { id: "checkpoint_active_task", from: "active", to: "checkpointed" },
  { id: "suspend_checkpoint", from: "checkpointed", to: "suspended" },
  { id: "begin_reorientation", from: "suspended", to: "reorienting" },
  { id: "reconcile_changed_context", from: "reorienting", to: "reconciling" },
  { id: "resume_unchanged_context", from: "reorienting", to: "resumed" },
  { id: "resume_reconciled_context", from: "reconciling", to: "resumed" },
  { id: "handoff_task", from: "active", to: "handed_off" },
  { id: "abandon_task", from: "active", to: "abandoned" },
];

export interface ContinuityMachine {
  readonly task: ContinuityTask;
  readonly state: ContinuityState;
  readonly checkpoint: Checkpoint | null;
  readonly resumeContext: ResumeContext | null;
  readonly reconciliation: ReconciliationRecord | null;
  readonly handoff: HandoffRecord | null;
  readonly disposalReason: string | null;
  readonly failureReason: string | null;
  fire<P extends ContinuityTransitionId>(id: P, payload: TransitionPayloadMap[P]): TransitionResult;
}

interface Internals {
  state: ContinuityState;
  task: ContinuityTask;
  checkpoint: Checkpoint | null;
  resumeContext: ResumeContext | null;
  reconciliation: ReconciliationRecord | null;
  handoff: HandoffRecord | null;
  disposalReason: string | null;
  failureReason: string | null;
}

function checkpointRevision(internals: Internals): string {
  return internals.checkpoint !== null ? internals.checkpoint.taskRevision : internals.task.taskRevision;
}

function guardHolds(
  internals: Internals,
  id: ContinuityTransitionId,
  payload: TransitionPayloadMap[ContinuityTransitionId],
): TransitionResult {
  if (id === "checkpoint_active_task") return checkpointScopeExplicit(payload as CheckpointScope);
  if (id === "suspend_checkpoint") {
    return interruptedInputPreserved(internals.task.validatedDraft, payload as SuspendPolicy);
  }
  if (id === "begin_reorientation") return resumeReorientsUser(payload as ResumeContext);
  if (id === "reconcile_changed_context") {
    return reconcileChangedContext(checkpointRevision(internals), payload as RevisionQuery);
  }
  if (id === "resume_unchanged_context") {
    return resumeReorientsUser(internals.resumeContext as ResumeContext);
  }
  if (id === "resume_reconciled_context") {
    return stalePendingActionsReconciled(
      internals.task.pendingActions,
      internals.reconciliation as ReconciliationRecord,
    );
  }
  return handoffPreservesOwnership(payload as HandoffRecord);
}

function buildReconciliation(internals: Internals, currentRevision: string): ReconciliationRecord {
  const dispositions: Record<string, "revalidated" | "rejected"> = {};
  for (const action of internals.task.pendingActions) {
    dispositions[action.actionId] =
      action.preparedAgainstRevision === currentRevision ? "revalidated" : "rejected";
  }
  return { checkpointRevision: checkpointRevision(internals), currentRevision, dispositions };
}

function applyEffect(
  internals: Internals,
  id: ContinuityTransitionId,
  payload: TransitionPayloadMap[ContinuityTransitionId],
): void {
  const row = CONTINUITY_TRANSITIONS.find((r) => r.id === id) as TransitionRow;
  internals.state = row.to;
  if (id === "checkpoint_active_task") {
    internals.checkpoint = {
      checkpointId: `checkpoint-${internals.task.taskRevision}`,
      taskRevision: internals.task.taskRevision,
      scope: payload as CheckpointScope,
    };
    return;
  }
  if (id === "suspend_checkpoint") {
    const policy = payload as SuspendPolicy;
    internals.disposalReason = policy.requiresDisposal === true ? (policy.disposalReason as string) : null;
    return;
  }
  if (id === "begin_reorientation") internals.resumeContext = payload as ResumeContext;
  if (id === "reconcile_changed_context") {
    internals.reconciliation = buildReconciliation(internals, (payload as RevisionQuery).currentRevision);
  }
  if (id === "handoff_task" || id === "abandon_task") internals.handoff = payload as HandoffRecord;
}

function refuse(internals: Internals, reason: string): TransitionResult {
  internals.failureReason = reason;
  return { ok: false, reason };
}

function fireTransition(
  internals: Internals,
  id: ContinuityTransitionId,
  payload: TransitionPayloadMap[ContinuityTransitionId],
): TransitionResult {
  const row = CONTINUITY_TRANSITIONS.find((r) => r.id === id);
  if (!row) return refuse(internals, `unknown transition ${id}`);
  if (internals.state !== row.from) {
    return refuse(internals, `transition ${id} cannot fire from state ${internals.state}`);
  }
  const guard = guardHolds(internals, id, payload);
  if (!guard.ok) return refuse(internals, guard.reason);
  applyEffect(internals, id, payload);
  return { ok: true };
}

function makeMachine(internals: Internals): ContinuityMachine {
  return {
    get task() {
      return internals.task;
    },
    get state() {
      return internals.state;
    },
    get checkpoint() {
      return internals.checkpoint;
    },
    get resumeContext() {
      return internals.resumeContext;
    },
    get reconciliation() {
      return internals.reconciliation;
    },
    get handoff() {
      return internals.handoff;
    },
    get disposalReason() {
      return internals.disposalReason;
    },
    get failureReason() {
      return internals.failureReason;
    },
    fire: <P extends ContinuityTransitionId>(id: P, payload: TransitionPayloadMap[P]) =>
      fireTransition(internals, id, payload as TransitionPayloadMap[ContinuityTransitionId]),
  };
}

export function createContinuityMachine(task: ContinuityTask): ContinuityMachine {
  const internals: Internals = {
    state: "active",
    task,
    checkpoint: null,
    resumeContext: null,
    reconciliation: null,
    handoff: null,
    disposalReason: null,
    failureReason: null,
  };
  return makeMachine(internals);
}