// Purpose: shared machine internals and guard helpers for the interaction runtime
// Responsibilities: the mutable runtime internals record, from-state checks, and guard-failure rendering
// Rationale: transitions and orchestration mutate the same internals — the shape lives in one place
import type {
  CommittedState,
  ContinuityCheckpoint,
  EventEnvelope,
  PersistencePort,
  RuntimeFailure,
  RuntimeState,
  TransitionId,
  TransitionResult,
} from "./types";

export interface Internals {
  state: RuntimeState;
  committed: CommittedState;
  pendingEvent: EventEnvelope | null;
  refreshedState: CommittedState | null;
  snapshotReceived: boolean;
  pendingNext: boolean;
  pollRequested: boolean;
  rejectionReason: string | null;
  malformedReason: string | null;
  lastFailure: RuntimeFailure | null;
  unknownEffect: RuntimeFailure | null;
  checkpoint: ContinuityCheckpoint | null;
  port: PersistencePort | null;
}

export function wrongState(id: TransitionId, state: RuntimeState): TransitionResult {
  return { ok: false, reason: `transition ${id} cannot fire from state ${state}` };
}

export function requireFrom(internals: Internals, id: TransitionId, from: RuntimeState): TransitionResult | null {
  return internals.state === from ? null : wrongState(id, internals.state);
}

export function guardFailed(guard: string, detail: string): TransitionResult {
  return { ok: false, reason: `guard ${guard} does not hold: ${detail}` };
}