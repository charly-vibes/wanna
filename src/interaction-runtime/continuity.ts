// Purpose: continuity checkpoints for the interaction runtime
// Responsibilities: build the suspension checkpoint and decide whether it still matches committed state on resume
// Rationale: suspension records everything resume needs to reorient — versions, revisions, applied event ids — and never guesses
import type { CommittedState, ContinuityCheckpoint } from "./types";
import { SCHEMA_VERSION, POLICY_VERSION } from "./types";

export function suspendCheckpoint(committed: CommittedState, reason: string): ContinuityCheckpoint {
  return {
    schemaVersion: SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    interactionRevision: committed.interactionRevision,
    taskRevision: committed.taskRevision,
    appliedEventIds: [...committed.appliedEventIds],
    retired: committed.retired,
    reason,
  };
}

function sameAppliedIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function checkpointMatches(committed: CommittedState, checkpoint: ContinuityCheckpoint): boolean {
  return (
    checkpoint.interactionRevision === committed.interactionRevision &&
    checkpoint.taskRevision === committed.taskRevision &&
    checkpoint.schemaVersion === SCHEMA_VERSION &&
    sameAppliedIds(checkpoint.appliedEventIds, committed.appliedEventIds)
  );
}
