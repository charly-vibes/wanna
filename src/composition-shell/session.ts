// Purpose: ready-shell session object for the composition shell (wanna-0te open slice, wanna-15e evaluation slice, wanna-8k6 commit/submit slice)
// Responsibilities: hold the aggregate state loaded through the declared port without aliasing it, compose the evaluateNeed pipeline over the shell's immutable pins, and run updateArtifact/commitDecision/submit through the port's conditional commit with revision-bound freshness checks; refresh reloads the authoritative snapshot (full retry semantics stay with wanna-gcp)
// Rationale: wanna-0te owns declared-port construction and load; evaluation is wanna-15e; commit/submit transactions, stale/duplicate/failure mappings and replay-folded continuity are wanna-8k6; reconcile and retry-blocking remain wanna-gcp stubs
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  AggregateSnapshot,
  EvaluateNeedOutcome,
  NeedProposalInput,
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  ReviewPersistencePort,
  ReviewProjection,
  ReviewSessionShell,
} from "./types";
import type { EvaluatedDecision, ShellPins } from "./evaluate";
import { evaluateNeedCommand } from "./evaluate";
import { domainFromReplay, projectFromDomain } from "./domain";
import type { InteractionRecord, ShellReplayEvent } from "./domain";

/** Commit outcomes that do not carry a fresh authoritative snapshot. */
type NonAppliedCommit = Exclude<PortCommitOutcome, { kind: "applied" }>;

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

/** Not-yet-landed command stub naming the owning ticket in the message. */
function stub(command: string, owner: string): never {
  throw new Error(`not implemented: ${owner} (${command})`);
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
interface ShellContext {
  pins: ShellPins;
  port: ReviewPersistencePort;
  /** Shell-local memory for evaluated decisions, consumed by the compare-and-commit path. */
  evaluatedDecisions: Map<string, EvaluatedDecision>;
  current: ShellState;
}

function interactionsOf(ctx: ShellContext): InteractionRecord[] {
  return domainFromReplay(ctx.current.replay);
}

function applySnapshot(ctx: ShellContext, snapshot: AggregateSnapshot): void {
  ctx.current = shellStateFromSnapshot(snapshot);
}

function projectOf(ctx: ShellContext): ReviewProjection {
  return projectFromDomain(ctx.current.taskRevision, interactionsOf(ctx));
}

/** One conditional commit through the declared port ([[composition.shell.commit_through_declared_port]]). */
async function commitOperation(
  ctx: ShellContext,
  expectedVersion: number | null,
  operation: PortOperation,
): Promise<PortCommitOutcome> {
  try {
    return await ctx.port.compareAndCommit(ctx.pins.key, expectedVersion, operation);
  } catch {
    // A thrown commit has an unknown durable effect; mapping to `unavailable`
    // would authorize a retry and risk silent double application
    // ([[composition.shell.uncertain_effect_blocks_mutation]]'s safe mapping).
    return { kind: "unknown_effect" };
  }
}

/** Outcome mapping shared by the commit-bound commands. */
function mapSimpleCommit(
  outcome: PortCommitOutcome,
): { applied: AggregateSnapshot } | { typed: NonAppliedCommit } {
  if (outcome.kind === "applied") return { applied: outcome.snapshot };
  return { typed: outcome }; // narrowed to the non-applied declared outcomes
}

async function updateArtifactCommand(
  ctx: ShellContext,
  command: Parameters<ReviewSessionShell["updateArtifact"]>[0],
): Promise<Awaited<ReturnType<ReviewSessionShell["updateArtifact"]>>> {
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
  const mapped = mapSimpleCommit(outcome);
  if ("applied" in mapped) {
    applySnapshot(ctx, mapped.applied);
    return { kind: "recorded" };
  }
  return mapped.typed.kind === "conflict" ? { kind: "stale" } : mapped.typed;
}

function findInteraction(
  ctx: ShellContext,
  interactionId: string,
): InteractionRecord | null {
  return (
    interactionsOf(ctx).find(
      (record) => record.interactionId === interactionId,
    ) ?? null
  );
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
    return { kind: "refreshed", projection: projectOf(ctx) };
  }
  if (loaded.kind === "not_found") {
    ctx.current = emptyShellState();
    return { kind: "refreshed", projection: projectOf(ctx) };
  }
  // recovery_required surfaces at the open boundary; full refresh/retry
  // semantics (including refusal without a new snapshot) stay with wanna-gcp.
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
  };
  return {
    updateArtifact: (command) => updateArtifactCommand(ctx, command),
    evaluateNeed: (proposal) => evaluateNeedShell(ctx, proposal),
    commitDecision: (command) => commitDecisionCommand(ctx, command),
    project: () => projectOf(ctx),
    submit: (command) => submitCommand(ctx, command),
    reconcile: async () => stub("reconcile", "wanna-gcp"),
    refresh: () => refreshFromPort(ctx),
  };
}
