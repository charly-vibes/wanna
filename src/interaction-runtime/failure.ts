// Purpose: typed failure records and persistence wiring for the interaction runtime
// Responsibilities: commit through a persistence port, classify failures by effect certainty, render the unknown-effect block reason
// Rationale: runtime failures are typed records with effect certainty — a lost acknowledgement is neither assumed applied nor assumed lost
import type { CommittedState, EventEnvelope, PersistencePort, ReplayRecord, RuntimeFailure } from "./types";
import { CONTRACT_VERSION, POLICY_VERSION } from "./types";

export function commitFailed(result: { ok: false; acknowledged: boolean; error: string }, eventId: string): RuntimeFailure {
  return result.acknowledged
    ? { code: "commit_failed_acknowledged", eventId, effectCertainty: "certain_no_effect", retryable: true, detail: result.error }
    : { code: "commit_acknowledgement_lost", eventId, effectCertainty: "unknown", retryable: false, detail: result.error };
}

export function unknownBlockReason(failure: RuntimeFailure): string {
  return `unknown_effect_blocks_retry: the effect of event ${failure.eventId} is unknown (${failure.detail}) — reconcile via refreshed committed state or prove idempotency before retrying`;
}

export function persist(
  port: PersistencePort | null,
  initial: CommittedState,
  next: CommittedState,
  event: EventEnvelope,
): RuntimeFailure | null {
  if (!port) return null;
  const record: ReplayRecord = {
    initial,
    events: [event],
    contractVersion: CONTRACT_VERSION,
    policyVersion: POLICY_VERSION,
  };
  const result = port.commit(next, record);
  return result.ok ? null : commitFailed(result, event.eventId);
}
