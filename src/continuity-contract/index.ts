// Purpose: public surface of the continuity-contract layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createContinuityMachine, CONTINUITY_TRANSITIONS } from "./machine";
export type { ContinuityMachine, TransitionRow } from "./machine";
export {
  authorizesAction,
  authoritativeProgress,
  checkpointScopeExplicit,
  ephemeraCannotMoveProgress,
  handoffPreservesOwnership,
  interruptedInputPreserved,
  pendingActionCommit,
  progressOmitsEphemera,
  reauthenticationRestoresTask,
  reconcileChangedContext,
  resumeReorientsUser,
  stalePendingActionsReconciled,
  EPHEMERA_FIELDS,
  HANDOFF_CATEGORIES,
  RESUME_FIELDS,
  SCOPE_CATEGORIES,
} from "./invariants";
export type {
  ActionDisposition,
  AuthOutcome,
  AuthSession,
  Check,
  Checkpoint,
  CheckpointScope,
  ContinuityState,
  ContinuityTask,
  ContinuityTransitionId,
  HandoffRecord,
  PendingAction,
  PresentationEphemera,
  ReconciliationRecord,
  ResumeContext,
  RevisionQuery,
  SuspendPolicy,
  TransitionPayloadMap,
  TransitionResult,
  ValidatedInput,
} from "./types";