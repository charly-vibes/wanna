// Purpose: lifecycle machinery for the composition shell (wanna-gcp)
// Responsibilities: the conditional-commit operation, freshness and uncertainty bookkeeping (absorb/refusal guards), interaction lookup, and the explicit cancel and reconcile commands
// Rationale: split from session.ts for the pretender file limit; the freshness guard implements [[composition.shell.refresh_requires_new_snapshot]], the uncertainty guard [[composition.shell.uncertain_effect_blocks_mutation]], and cancel [[composition.shell.retirement_explicit]]
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  AggregateSnapshot,
  CancelCommand,
  CancelOutcome,
  PortCommitOutcome,
  PortOperation,
  ReconcileOutcome,
  ReviewPersistencePort,
} from "./types";
import type { ShellContext } from "./session";
import type { InteractionRecord, ShellReplayEvent } from "./domain";
import { domainFromReplay } from "./domain";

/** Folded interaction state over the shell's current replay. */
function interactionsOf(ctx: ShellContext): InteractionRecord[] {
  return domainFromReplay(ctx.current.replay);
}
import { shellStateFromSnapshot } from "./session";

/** Copy a fresh authoritative snapshot into shell-owned state; no aliasing of port storage. */
export function applySnapshot(ctx: ShellContext, snapshot: AggregateSnapshot): void {
  ctx.current = shellStateFromSnapshot(snapshot);
}

/** One conditional commit through the declared port ([[composition.shell.commit_through_declared_port]]). */
export async function commitOperation(
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


export function conflictContradictsSnapshot(
  ctx: ShellContext,
  expectedVersion: number | null,
): boolean {
  if (expectedVersion === null) return ctx.current.aggregateVersion === 0;
  return expectedVersion >= ctx.current.aggregateVersion;
}

/**
 * Absorb a commit outcome's freshness and uncertainty consequences into the
 * shell state ([[composition.shell.refresh_requires_new_snapshot]],
 * [[composition.shell.uncertain_effect_blocks_mutation]]).
 */
export function absorbCommitOutcome(
  ctx: ShellContext,
  expectedVersion: number | null,
  operationId: string,
  outcome: PortCommitOutcome,
): void {
  if (outcome.kind === "applied") {
    ctx.requiresRefresh = false;
    return;
  }
  if (outcome.kind === "conflict") {
    if (conflictContradictsSnapshot(ctx, expectedVersion)) {
      ctx.requiresRefresh = true;
    }
    return;
  }
  if (outcome.kind === "unknown_effect") {
    ctx.uncertain.add(operationId);
  }
}

/**
 * Refusal guard for every mutation command. While an uncertain commit stands,
 * the refusal is declared `unknown_effect` — the conservative declared outcome
 * that never authorizes retry ([[composition.shell.uncertain_effect_blocks_mutation]]);
 * while a cross-writer stale rejection stands it is declared `stale` — retry
 * requires a refreshed snapshot first ([[composition.shell.refresh_requires_new_snapshot]]).
 * No port contact happens for a refused command.
 */

export function mutationRefusal(ctx: ShellContext): { kind: "stale" } | { kind: "unknown_effect" } | null {
  if (ctx.uncertain.size > 0) return { kind: "unknown_effect" };
  if (ctx.requiresRefresh) return { kind: "stale" };
  return null;
}

export function findInteraction(
  ctx: ShellContext,
  interactionId: string,
): InteractionRecord | null {
  return (
    interactionsOf(ctx).find(
      (record) => record.interactionId === interactionId,
    ) ?? null
  );
}

/**
 * Explicit retirement ([[composition.shell.retirement_explicit]]): the only
 * command that retires an active interaction. Artifact changes, evaluation and
 * feedback never retire implicitly; cancelling an unknown or already completed
 * interaction is a typed stale refusal with no mutation.
 */

export async function cancelCommand(
  ctx: ShellContext,
  command: CancelCommand,
): Promise<CancelOutcome> {
  const refusal = mutationRefusal(ctx);
  if (refusal) return refusal;
  const interaction = findInteraction(ctx, command.interactionId);
  if (interaction === null || interaction.status !== "pending") {
    return { kind: "stale" };
  }
  const event: ShellReplayEvent = {
    shellEvent: "review_retired",
    interactionId: command.interactionId,
    operationId: command.operationId,
  };
  const outcome = await commitOperation(ctx, ctx.current.aggregateVersion, {
    operationId: command.operationId,
    expectedTaskRevision: null,
    expectedInteractionRevision: null,
    stateChanges: { reviewRetired: event },
    replayAdditions: [event],
  });
  absorbCommitOutcome(ctx, ctx.current.aggregateVersion, command.operationId, outcome);
  if (outcome.kind === "applied") {
    applySnapshot(ctx, outcome.snapshot);
    return { kind: "retired" };
  }
  return outcome.kind === "conflict" ? { kind: "stale" } : outcome;
}

/**
 * Authoritative reconciliation of an uncertain commit
 * ([[composition.shell.uncertain_effect_blocks_mutation]]): only an outcome
 * from this port call unblocks mutation — a fresh snapshot alone never does.
 * The applied snapshot also refreshes shell state; `not_applied` requires
 * authoritative proof the operation cannot later commit.
 */

export async function reconcileCommand(
  ctx: ShellContext,
  operationId: string,
): Promise<ReconcileOutcome> {
  let outcome: Awaited<ReturnType<ReviewPersistencePort["reconcile"]>>;
  try {
    outcome = await ctx.port.reconcile(ctx.pins.key, operationId);
  } catch {
    // A thrown reconciliation has no authoritative proof either way; the
    // uncertainty stands and mutation stays blocked.
    return { kind: "unknown_effect" };
  }
  if (outcome.kind === "applied") {
    applySnapshot(ctx, outcome.snapshot);
    ctx.uncertain.delete(operationId);
    ctx.requiresRefresh = false;
    return { kind: "applied", snapshot: outcome.snapshot };
  }
  if (outcome.kind === "not_applied") {
    ctx.uncertain.delete(operationId);
    return { kind: "not_applied" };
  }
  return { kind: "unknown_effect" };
}
