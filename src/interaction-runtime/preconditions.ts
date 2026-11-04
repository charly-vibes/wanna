// Purpose: commit-precondition checks for the interaction runtime
// Responsibilities: decide event_commit_preconditions_satisfied with a distinct stable reason code per rejection class
// Rationale: stale, duplicate, contract-incompatible, and identity-mismatched events are separate rejection classes — never one generic error
import type { Check, CommittedState, EventEnvelope } from "./types";

export function commitPreconditionsSatisfied(state: CommittedState, event: EventEnvelope): Check {
  const failures: readonly [boolean, string][] = [
    [
      event.taskId !== state.taskId || event.interactionId !== state.interactionId,
      `identity_mismatch: event task ${event.taskId}/interaction ${event.interactionId} does not match committed task ${state.taskId}/interaction ${state.interactionId}`,
    ],
    [state.retired, "retired_interaction: the interaction is retired; no further events are accepted"],
    [
      event.contractVersion !== state.contractVersion,
      `contract_incompatible: event version ${event.contractVersion} does not match committed version ${state.contractVersion}`,
    ],
    [state.appliedEventIds.includes(event.eventId), `duplicate_event_id: event ${event.eventId} has already been applied`],
    [
      event.interactionRevision !== state.interactionRevision,
      `stale_interaction_revision: event expects ${event.interactionRevision}, committed is ${state.interactionRevision}`,
    ],
    [
      event.taskRevision !== state.taskRevision,
      `stale_task_revision: event task-revision precondition ${event.taskRevision} does not match committed ${state.taskRevision}`,
    ],
  ];
  for (const [failed, reason] of failures) {
    if (failed) return { ok: false, reason };
  }
  return { ok: true };
}
