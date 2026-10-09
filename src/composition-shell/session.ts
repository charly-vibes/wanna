// Purpose: ready-shell session object for the composition shell (wanna-0te open slice, wanna-15e evaluation slice, wanna-8k6 commit/submit slice, wanna-gcp lifecycle slice)
// Responsibilities: hold the aggregate state loaded through the declared port without aliasing it, compose the evaluateNeed pipeline over the shell's immutable pins, run updateArtifact/commitDecision/submit/cancel through the port's conditional commit with revision-bound freshness checks, refuse mutations after cross-writer stale rejections until refresh, block mutations after unknown commit effects until reconciliation, and implement reconcile/refresh over the port
// Rationale: wanna-0te owns declared-port construction and load; evaluation is wanna-15e; commit/submit transactions, stale/duplicate/failure mappings and replay-folded continuity are wanna-8k6; explicit retirement, retry-requires-refresh and uncertain-effect reconciliation are wanna-gcp
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  AggregateSnapshot,
  EvaluateNeedOutcome,
  NeedProposalInput,
  PortCommitOutcome,
  PortLoadOutcome,
  ReviewPersistencePort,
  ReviewProjection,
  ReviewSessionShell,
} from "./types";
import type { EvaluatedDecision, ShellPins } from "./evaluate";
import { evaluateNeedCommand } from "./evaluate";
import { domainFromReplay, projectFromDomain } from "./domain";
import {
  absorbCommitOutcome,
  applySnapshot,
  cancelCommand,
  commitOperation,
  findInteraction,
  mutationRefusal,
  reconcileCommand,
} from "./lifecycle";
import type { InteractionRecord, ShellReplayEvent } from "./domain";

/**
 * Committed-state view held by an opened shell. Copied from the port snapshot
 * at the open boundary — never a reference into port storage — and mutated
 * only through declared port outcomes ([[composition.shell.commits_only_via_port]]).
 */
export interface ShellState {
  readonly aggregateVersion: number;
  readonly taskRevision: number;
  readonly replay: readonly unknown[];
  readonly receipts: readonly unknown[];
}

/** State of a key that exists nowhere yet ([[composition.shell.commits_only_via_port]]). */
export function emptyShellState(): ShellState {
  return { aggregateVersion: 0, taskRevision: 0, replay: [], receipts: [] };
}

/** Copy a port snapshot into shell-owned state; no aliasing of port storage. */
export function shellStateFromSnapshot(snapshot: AggregateSnapshot): ShellState {
  return {
    aggregateVersion: snapshot.aggregateVersion,
    taskRevision: snapshot.taskRevision,
    replay: [...snapshot.replay],
    receipts: [...snapshot.receipts],
  };
}

/**
 * Open-slice projection is superseded by the domain-folded projection
 * (wanna-8k6): with no recorded interaction the view matches the original
 * open-slice shape ([[composition.shell.projection_derived_not_authoritative]]).
 */
export function projectState(state: ShellState): ReviewProjection {
  return projectFromDomain(
    state.taskRevision,
    domainFromReplay(state.replay),
  );
}

/** Opened-review replay event for a committed decision, with deterministic identities. */
function reviewOpenedEvent(
  taskId: string,
  decision: EvaluatedDecision,
  ordinal: number,
): ShellReplayEvent {
  return {
    shellEvent: "review_opened",
    interactionId: `${taskId}:interaction:${ordinal}`,
    reviewId: `${taskId}:review:${decision.taskRevision}:${decision.provenance.proposalId}`,
    revision: decision.taskRevision,
    interactionRevision: ordinal,
    provenance: decision.provenance,
  };
}

/** Completed-review replay event for a recorded response. */
function reviewCompletedEvent(
  interactionId: string,
  eventId: string,
  feedback: string,
): ShellReplayEvent {
  return {
    shellEvent: "review_completed",
    interactionId,
    eventId,
    feedback,
  };
}

/**
 * Create the ready shell exposing the composed surface over `state`, bound to
 * the immutable policy/catalog pins and the declared port
 * ([[composition.shell.evaluation_versions_pinned]], [[composition.shell.commit_through_declared_port]]).
 */
export interface ShellContext {
  pins: ShellPins;
  port: ReviewPersistencePort;
  /** Shell-local memory for evaluated decisions, consumed by the compare-and-commit path. */
  evaluatedDecisions: Map<string, EvaluatedDecision>;
  current: ShellState;
  /**
   * A cross-writer state-precondition rejection stands ([[composition.shell.refresh_requires_new_snapshot]]):
   * mutations are refused until a refreshed authoritative snapshot arrives.
   */
  requiresRefresh: boolean;
  /**
   * Operation ids with an unknown durable effect ([[composition.shell.uncertain_effect_blocks_mutation]]):
   * mutations are refused until reconciliation proves application or non-application.
   */
  uncertain: Set<string>;
}

function interactionsOf(ctx: ShellContext): InteractionRecord[] {
  return domainFromReplay(ctx.current.replay);
}


function projectOf(ctx: ShellContext): ReviewProjection {
  return projectFromDomain(ctx.current.taskRevision, interactionsOf(ctx));
}

/** Outcome mapping shared by the commit-bound commands. */
function mapSimpleCommit(outcome: PortCommitOutcome): { applied: AggregateSnapshot } | { typed: Exclude<PortCommitOutcome, { kind: "applied" }> } {
  if (outcome.kind === "applied") return { applied: outcome.snapshot };
  return { typed: outcome }; // narrowed to the non-applied declared outcomes
}

async function updateArtifactCommand(
  ctx: ShellContext,
  command: Parameters<ReviewSessionShell["updateArtifact"]>[0],
): Promise<Awaited<ReturnType<ReviewSessionShell["updateArtifact"]>>> {
  const refusal = mutationRefusal(ctx);
  if (refusal) return refusal;
  const outcome = await commitOperation(ctx, command.expectedAggregateVersion, {
    operationId: command.operationId,
    expectedTaskRevision: null,
    expectedInteractionRevision: null,
    stateChanges: {
      taskRevision: command.revision,
      contentRef: command.contentRef,
    },
    replayAdditions: [],
  });
  absorbCommitOutcome(ctx, command.expectedAggregateVersion, command.operationId, outcome);
  const mapped = mapSimpleCommit(outcome);
  if ("applied" in mapped) {
    applySnapshot(ctx, mapped.applied);
    return { kind: "applied", aggregateVersion: mapped.applied.aggregateVersion };
  }
  return mapped.typed.kind === "conflict" ? { kind: "stale" } : mapped.typed;
}

async function evaluateNeedShell(
  ctx: ShellContext,
  proposal: NeedProposalInput,
): Promise<EvaluateNeedOutcome> {
  const outcome = await evaluateNeedCommand(ctx.current, ctx.pins, proposal);
  if (outcome.kind === "decided") {
    ctx.evaluatedDecisions.set(outcome.id, {
      id: outcome.id,
      taskRevision: outcome.taskRevision,
      provenance: outcome.provenance,
      recommendations: outcome.recommendations,
    });
  }
  return outcome;
}

async function commitDecisionCommand(
  ctx: ShellContext,
  command: Parameters<ReviewSessionShell["commitDecision"]>[0],
): Promise<Awaited<ReturnType<ReviewSessionShell["commitDecision"]>>> {
  const refusal = mutationRefusal(ctx);
  if (refusal) return refusal;
  const decision = ctx.evaluatedDecisions.get(command.decisionId);
  // A decision this shell never evaluated, or one bound to a revision that
  // is no longer authoritative, cannot commit as current
  // ([[composition.shell.decision_freshness_atomic]]); the same bound rides
  // the operation for ports that enforce it storage-side.
  if (!decision || decision.taskRevision !== ctx.current.taskRevision) {
    return { kind: "stale" };
  }
  const ordinal = interactionsOf(ctx).length + 1;
  const event = reviewOpenedEvent(ctx.pins.key.taskId, decision, ordinal);
  const outcome = await commitOperation(ctx, ctx.current.aggregateVersion, {
    operationId: command.operationId,
    expectedTaskRevision: decision.taskRevision,
    expectedInteractionRevision: null,
    stateChanges: { reviewOpened: event },
    replayAdditions: [event],
  });
  absorbCommitOutcome(ctx, ctx.current.aggregateVersion, command.operationId, outcome);
  const mapped = mapSimpleCommit(outcome);
  if ("applied" in mapped) {
    applySnapshot(ctx, mapped.applied);
    return { kind: "committed", interactionId: event.interactionId };
  }
  return mapped.typed.kind === "conflict" ? { kind: "stale" } : mapped.typed;
}

async function submitCommand(
  ctx: ShellContext,
  command: Parameters<ReviewSessionShell["submit"]>[0],
): Promise<Awaited<ReturnType<ReviewSessionShell["submit"]>>> {
  const refusal = mutationRefusal(ctx);
  if (refusal) return refusal;
  const interaction = findInteraction(ctx, command.interactionId);
  if (interaction === null) return { kind: "stale" };
  const preconditionMismatch =
    command.expectedTaskRevision !== ctx.current.taskRevision ||
    command.expectedInteractionRevision !== interaction.interactionRevision;
  // Current-revision preconditions ([[composition.shell.event_preconditions_current]]):
  // the interaction must exist and the caller's revisions must match the
  // authoritative snapshot; any mismatch is a typed stale rejection that
  // mutates nothing.
  if (preconditionMismatch) return { kind: "stale" };
  const event = reviewCompletedEvent(
    command.interactionId,
    command.eventId,
    command.feedback,
  );
  const outcome = await commitOperation(ctx, ctx.current.aggregateVersion, {
    operationId: command.eventId,
    expectedTaskRevision: command.expectedTaskRevision,
    expectedInteractionRevision: command.expectedInteractionRevision,
    stateChanges: { reviewCompleted: event },
    replayAdditions: [event],
  });
  absorbCommitOutcome(ctx, ctx.current.aggregateVersion, command.eventId, outcome);
  const mapped = mapSimpleCommit(outcome);
  if ("applied" in mapped) {
    applySnapshot(ctx, mapped.applied);
    return { kind: "recorded" };
  }
  return mapped.typed.kind === "conflict" ? { kind: "stale" } : mapped.typed;
}

async function refreshFromPort(
  ctx: ShellContext,
): Promise<Awaited<ReturnType<ReviewSessionShell["refresh"]>>> {
  let loaded: PortLoadOutcome;
  try {
    loaded = await ctx.port.load(ctx.pins.key);
  } catch {
    return { kind: "unavailable" };
  }
  if (loaded.kind === "loaded") {
    applySnapshot(ctx, loaded.snapshot);
    ctx.requiresRefresh = false;
    return { kind: "refreshed", projection: projectOf(ctx) };
  }
  if (loaded.kind === "not_found") {
    ctx.current = emptyShellState();
    ctx.requiresRefresh = false;
    return { kind: "refreshed", projection: projectOf(ctx) };
  }
  // recovery_required surfaces at the open boundary; refresh leaves the
  // refresh requirement standing — no refreshed snapshot arrived.
  return { kind: "unavailable" };
}

/**
 * Create the ready shell exposing the composed surface over `state`, bound to
 * the immutable policy/catalog pins and the declared port
 * ([[composition.shell.evaluation_versions_pinned]], [[composition.shell.commit_through_declared_port]]).
 */
export function createReviewSessionShell(
  state: ShellState,
  pins: ShellPins,
  port: ReviewPersistencePort,
): ReviewSessionShell {
  const ctx: ShellContext = {
    pins,
    port,
    // Evaluation alone never touches `state` or the port — design.md:
    // "Evaluation alone does not mutate the aggregate". A decision never
    // evaluated by this shell instance cannot commit as current.
    evaluatedDecisions: new Map<string, EvaluatedDecision>(),
    current: state,
    requiresRefresh: false,
    uncertain: new Set<string>(),
  };
  return {
    updateArtifact: (command) => updateArtifactCommand(ctx, command),
    evaluateNeed: (proposal) => evaluateNeedShell(ctx, proposal),
    commitDecision: (command) => commitDecisionCommand(ctx, command),
    project: () => projectOf(ctx),
    submit: (command) => submitCommand(ctx, command),
    cancel: (command) => cancelCommand(ctx, command),
    reconcile: (operationId) => reconcileCommand(ctx, operationId),
    refresh: () => refreshFromPort(ctx),
  };
}
