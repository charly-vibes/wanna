// Purpose: commit-precondition checks for the interaction runtime
// Responsibilities: decide event_commit_preconditions_satisfied with a distinct stable reason code per rejection class
// Rationale: stale, duplicate, contract-incompatible, and identity-mismatched events are separate rejection classes — never one generic error
import type { Check, CommittedState, EventEnvelope } from "./types";

export function commitPreconditionsSatisfied(state: CommittedState, event: EventEnvelope): Check {
  if (event.taskId !== state.taskId || event.interactionId !== state.interactionId) {
    return {
      ok: false,
      reason: `identity_mismatch: event task ${event.taskId}/interaction ${event.interactionId} does not match committed task ${state.taskId}/interaction ${state.interactionId}`,
    };
  }
  if (state.retired) {
    return { ok: false, reason: "retired_interaction: the interaction is retired; no further events are accepted" };
  }
  if (event.contractVersion !== state.contractVersion) {
    return {
      ok: false,
      reason: `contract_incompatible: event version ${event.contractVersion} does not match committed version ${state.contractVersion}`,
    };
  }
  if (state.appliedEventIds.includes(event.eventId)) {
    return { ok: false, reason: `duplicate_event_id: event ${event.eventId} has already been applied` };
  }
  if (event.interactionRevision !== state.interactionRevision) {
    return {
      ok: false,
      reason: `stale_interaction_revision: event expects ${event.interactionRevision}, committed is ${state.interactionRevision}`,
    };
  }
  if (event.taskRevision !== state.taskRevision) {
    return {
      ok: false,
      reason: `stale_task_revision: event task-revision precondition ${event.taskRevision} does not match committed ${state.taskRevision}`,
    };
  }
  return { ok: true };
}
