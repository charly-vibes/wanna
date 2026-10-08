// Purpose: invariants for the continuity-contract machine
// Responsibilities: the seven corpus constraints as precise-check functions, plus reauthentication semantics
// Rationale: each invariant returns an exact failure reason so negative tests can assert it verbatim
import type {
  AuthOutcome,
  AuthSession,
  CheckpointScope,
  Check,
  ContinuityTask,
  HandoffRecord,
  PendingAction,
  ReconciliationRecord,
  ResumeContext,
  RevisionQuery,
  SuspendPolicy,
  ValidatedInput,
} from "./types";

interface Category {
  readonly field: string;
  readonly label: string;
}

export const SCOPE_CATEGORIES: readonly Category[] = [
  { field: "persistedData", label: "persisted domain/workflow data" },
  { field: "uncommittedDrafts", label: "uncommitted drafts" },
  { field: "activeInteractions", label: "active interactions" },
  { field: "pendingEffects", label: "pending effects" },
  { field: "evidenceRefs", label: "evidence" },
  { field: "excludedEphemera", label: "deliberately excluded ephemeral presentation state" },
];

export const RESUME_FIELDS: readonly Category[] = [
  { field: "priorGoal", label: "prior goal/context" },
  { field: "lastConfirmedState", label: "last confirmed state" },
  { field: "completed", label: "work completed" },
  { field: "pending", label: "pending work" },
  { field: "changedSinceSuspension", label: "changes since suspension" },
  { field: "unresolvedFailures", label: "unresolved failures" },
  { field: "nextAction", label: "required next action" },
];

export const HANDOFF_CATEGORIES: readonly Category[] = [
  { field: "currentOwner", label: "current owner" },
  { field: "authorityScope", label: "transferred authority scope" },
  { field: "pendingDecisions", label: "pending decisions" },
  { field: "unresolvedRisks", label: "unresolved risks" },
  { field: "evidenceRefs", label: "evidence references" },
];

export const EPHEMERA_FIELDS = ["scrollPosition", "cursorLocation", "openPanel", "hostFocus"] as const;

function missingLabels(record: unknown, categories: readonly Category[]): string[] {
  if (typeof record !== "object" || record === null) return categories.map((c) => c.label);
  const r = record as Record<string, unknown>;
  return categories
    .filter((c) => {
      const value = r[c.field];
      if (typeof value === "string") return value.length === 0;
      return !Array.isArray(value);
    })
    .map((c) => c.label);
}

function categoriesGuard(
  guardName: string,
  noun: string,
  verb: string,
  record: unknown,
  categories: readonly Category[],
): Check {
  const missing = missingLabels(record, categories);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `guard ${guardName} does not hold: ${noun} does not ${verb} ${missing.join(", ")}`,
    };
  }
  return { ok: true };
}

export function checkpointScopeExplicit(scope: CheckpointScope): Check {
  if (scope === undefined || scope === null) {
    return { ok: false, reason: "guard checkpoint_scope_explicit does not hold: no checkpoint scope provided" };
  }
  return categoriesGuard("checkpoint_scope_explicit", "checkpoint scope", "identify", scope, SCOPE_CATEGORIES);
}

export function resumeReorientsUser(context: ResumeContext): Check {
  if (context === undefined || context === null) {
    return { ok: false, reason: "guard resume_reorients_user does not hold: no resume context provided" };
  }
  return categoriesGuard("resume_reorients_user", "resume context", "expose", context, RESUME_FIELDS);
}

export function handoffPreservesOwnership(record: HandoffRecord): Check {
  if (record === undefined || record === null) {
    return { ok: false, reason: "guard handoff_preserves_ownership does not hold: no handoff record provided" };
  }
  return categoriesGuard("handoff_preserves_ownership", "handoff record", "preserve", record, HANDOFF_CATEGORIES);
}

const INPUT = "guard interrupted_input_preserved does not hold: ";

export function interruptedInputPreserved(draft: ValidatedInput | undefined, policy: SuspendPolicy): Check {
  if (policy.requiresDisposal === true) {
    if (typeof policy.disposalReason === "string" && policy.disposalReason.length > 0) return { ok: true };
    return {
      ok: false,
      reason: `${INPUT}policy requires disposal of validated input but the loss is not explicit (missing disposal reason)`,
    };
  }
  return { ok: true };
}

const STALE = "guard stale_context_reconciled does not hold: ";

export function reconcileChangedContext(checkpointRevision: string, query: RevisionQuery): Check {
  if (query.currentRevision === checkpointRevision) {
    return {
      ok: false,
      reason: `${STALE}authoritative revision ${query.currentRevision} is unchanged since the checkpoint — resume via resume_unchanged_context`,
    };
  }
  return { ok: true };
}

export function stalePendingActionsReconciled(
  actions: readonly PendingAction[],
  record: ReconciliationRecord,
): Check {
  const undisposed = actions.find((a) => record.dispositions[a.actionId] === undefined);
  if (undisposed) {
    return { ok: false, reason: `${STALE}pending action ${undisposed.actionId} has no reconciliation disposition` };
  }
  return { ok: true };
}

export function pendingActionCommit(
  action: PendingAction,
  currentRevision: string,
  reconciliation: ReconciliationRecord | null,
): Check {
  if (reconciliation === null) {
    return {
      ok: false,
      reason: `${STALE}pending action ${action.actionId} cannot commit before revision ${currentRevision} is reconciled`,
    };
  }
  const disposition = reconciliation.dispositions[action.actionId];
  if (disposition === undefined) {
    return { ok: false, reason: `${STALE}pending action ${action.actionId} has no reconciliation disposition` };
  }
  if (disposition === "rejected") {
    return {
      ok: false,
      reason: `${STALE}pending action ${action.actionId} was rejected by reconciliation as stale and cannot silently commit`,
    };
  }
  if (action.preparedAgainstRevision !== currentRevision) {
    return {
      ok: false,
      reason: `${STALE}pending action ${action.actionId} was prepared against revision ${action.preparedAgainstRevision} but the authoritative revision is ${currentRevision}`,
    };
  }
  return { ok: true };
}

export function authoritativeProgress(task: ContinuityTask): string {
  return `completed=${task.completed.length} pending=${task.pending.length}`;
}

export function ephemeraCannotMoveProgress(before: ContinuityTask, after: ContinuityTask): Check {
  if (authoritativeProgress(before) !== authoritativeProgress(after)) {
    return {
      ok: false,
      reason:
        "guard presentation_ephemera_not_authoritative does not hold: authoritative task progress moved while only presentation ephemera changed",
    };
  }
  return { ok: true };
}

export function progressOmitsEphemera(task: ContinuityTask): Check {
  const progress = authoritativeProgress(task);
  const ephemera = task.ephemera as Record<string, unknown>;
  const leaked = EPHEMERA_FIELDS.filter((field) => {
    const value = ephemera[field];
    return value !== undefined && progress.includes(String(value));
  });
  if (leaked.length > 0) {
    return {
      ok: false,
      reason: `guard presentation_ephemera_not_authoritative does not hold: authoritative task progress embeds presentation ephemera (${leaked.join(", ")})`,
    };
  }
  return { ok: true };
}

export function reauthenticationRestoresTask(task: ContinuityTask, outcome: AuthOutcome): AuthSession {
  return {
    authenticated: outcome.authenticated,
    taskContext: {
      priorGoal: task.goal,
      lastConfirmedState: task.lastConfirmedState,
      completed: [...task.completed],
      pending: [...task.pending],
      changedSinceSuspension: [],
      unresolvedFailures: [],
      nextAction: "review the restored task context before continuing",
    },
    validatedDraft: task.validatedDraft,
    actionAuthorizations: [],
  };
}

export function authorizesAction(session: AuthSession, actionId: string): Check {
  if (session.actionAuthorizations.includes(actionId)) return { ok: true };
  return {
    ok: false,
    reason: `action ${actionId} is not authorized — authentication success is not action authorization`,
  };
}