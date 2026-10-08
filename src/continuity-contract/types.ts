// Purpose: vocabulary and record shapes for the continuity-contract layer
// Responsibilities: continuity states, transition ids, checkpoint/resume/reconciliation/handoff records, ephemera, and payload typing
// Rationale: continuity works on typed records; presentation ephemera is carried but never authoritative
export type ContinuityState =
  | "active"
  | "checkpointed"
  | "suspended"
  | "reorienting"
  | "reconciling"
  | "resumed"
  | "handed_off"
  | "abandoned";

export type ContinuityTransitionId =
  | "checkpoint_active_task"
  | "suspend_checkpoint"
  | "begin_reorientation"
  | "reconcile_changed_context"
  | "resume_unchanged_context"
  | "resume_reconciled_context"
  | "handoff_task"
  | "abandon_task";

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type TransitionResult = Check;

export interface CheckpointScope {
  readonly persistedData?: readonly string[];
  readonly uncommittedDrafts?: readonly string[];
  readonly activeInteractions?: readonly string[];
  readonly pendingEffects?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly excludedEphemera?: readonly string[];
}

export interface Checkpoint {
  readonly checkpointId: string;
  readonly taskRevision: string;
  readonly scope: CheckpointScope;
}

export interface ValidatedInput {
  readonly content: string;
  readonly validated: boolean;
}

export interface SuspendPolicy {
  readonly requiresDisposal?: boolean;
  readonly disposalReason?: string;
}

export interface ResumeContext {
  readonly priorGoal?: string;
  readonly lastConfirmedState?: string;
  readonly completed?: readonly string[];
  readonly pending?: readonly string[];
  readonly changedSinceSuspension?: readonly string[];
  readonly unresolvedFailures?: readonly string[];
  readonly nextAction?: string;
}

export interface PendingAction {
  readonly actionId: string;
  readonly preparedAgainstRevision: string;
}

export type ActionDisposition = "revalidated" | "rejected";

export interface ReconciliationRecord {
  readonly checkpointRevision: string;
  readonly currentRevision: string;
  readonly dispositions: Readonly<Record<string, ActionDisposition>>;
}

export interface HandoffRecord {
  readonly currentOwner?: string;
  readonly newOwner?: string;
  readonly authorityScope?: readonly string[];
  readonly pendingDecisions?: readonly string[];
  readonly unresolvedRisks?: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface PresentationEphemera {
  readonly scrollPosition?: number;
  readonly cursorLocation?: string;
  readonly openPanel?: string;
  readonly hostFocus?: string;
}

export interface ContinuityTask {
  readonly taskRevision: string;
  readonly goal: string;
  readonly lastConfirmedState: string;
  readonly completed: readonly string[];
  readonly pending: readonly string[];
  readonly pendingActions: readonly PendingAction[];
  readonly validatedDraft?: ValidatedInput;
  readonly ephemera: PresentationEphemera;
}

export interface RevisionQuery {
  readonly currentRevision: string;
}

export interface AuthOutcome {
  readonly authenticated: boolean;
  readonly method: string;
}

export interface AuthSession {
  readonly authenticated: boolean;
  readonly taskContext: ResumeContext;
  readonly validatedDraft?: ValidatedInput;
  readonly actionAuthorizations: readonly string[];
}

export type TransitionPayloadMap = {
  checkpoint_active_task: CheckpointScope;
  suspend_checkpoint: SuspendPolicy;
  begin_reorientation: ResumeContext;
  reconcile_changed_context: RevisionQuery;
  resume_unchanged_context: undefined;
  resume_reconciled_context: undefined;
  handoff_task: HandoffRecord;
  abandon_task: HandoffRecord;
};