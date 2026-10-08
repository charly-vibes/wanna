// Purpose: the interaction-runtime state machine
// Responsibilities: the eight [[spec]] model transitions with their guards, event submission orchestration, persistence-port wiring, typed failure records, suspension checkpoints
// Rationale: stale, duplicate, malformed, and unknown-effect paths are explicit — nothing is silently applied or retried
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
import { envelopeValid } from "./envelope";
import { commitPreconditionsSatisfied } from "./preconditions";
import { isLifecycle } from "./reducer";
import { unknownBlockReason } from "./failure";
import { checkpointMatches, suspendCheckpoint } from "./continuity";
import { fireTransition } from "./transitions";
import type { Internals } from "./internals";

export type SubmitResult =
  | { readonly ok: true; readonly state: RuntimeState }
  | { readonly ok: false; readonly reason: string; readonly failure: RuntimeFailure | null };

export interface InteractionRuntime {
  readonly state: RuntimeState;
  readonly committed: CommittedState;
  readonly malformedReason: string | null;
  readonly rejectionReason: string | null;
  readonly lastFailure: RuntimeFailure | null;
  readonly unknownEffect: RuntimeFailure | null;
  readonly checkpoint: ContinuityCheckpoint | null;
  readonly declaredSemantics: "no-persistence-port" | "atomic" | "weaker-declared";
  fire(id: TransitionId, input?: EventEnvelope): TransitionResult;
  submit(event: EventEnvelope): SubmitResult;
  poll(): TransitionResult;
  receiveStateSnapshot(snapshot: CommittedState): TransitionResult;
  resolveUnknownEffect(provenIdempotent: boolean): TransitionResult;
  suspend(reason: string): ContinuityCheckpoint;
  resume(checkpoint: ContinuityCheckpoint): TransitionResult;
  attachPersistence(port: PersistencePort): void;
}

function dispatchLifecycle(internals: Internals, event: EventEnvelope): SubmitResult {
  const envelope = envelopeValid(event);
  if (!envelope.ok) {
    const rejected = fireTransition(internals, "reject_malformed_envelope", event);
    return rejected.ok ? { ok: true, state: internals.state } : { ok: false, reason: rejected.reason, failure: null };
  }
  const retired = fireTransition(internals, "retire_interaction", event);
  return retired.ok
    ? { ok: true, state: internals.state }
    : { ok: false, reason: retired.reason, failure: internals.lastFailure };
}

function dispatchFresh(internals: Internals, event: EventEnvelope): SubmitResult {
  if (isLifecycle(event.eventType)) return dispatchLifecycle(internals, event);
  const validated = fireTransition(internals, "validate_envelope", event);
  if (!validated.ok) {
    const malformed = fireTransition(internals, "reject_malformed_envelope", event);
    return malformed.ok
      ? { ok: false, reason: internals.malformedReason ?? validated.reason, failure: null }
      : { ok: false, reason: validated.reason, failure: null };
  }
  const preconditions = commitPreconditionsSatisfied(internals.committed, event);
  if (!preconditions.ok) {
    const rejected = fireTransition(internals, "reject_stale_or_duplicate");
    if (!rejected.ok) return { ok: false, reason: preconditions.reason, failure: null };
    return { ok: false, reason: internals.rejectionReason ?? preconditions.reason, failure: null };
  }
  const applied = fireTransition(internals, "apply_current_event");
  return applied.ok
    ? { ok: true, state: internals.state }
    : { ok: false, reason: applied.reason, failure: internals.lastFailure };
}

function submitAfterRejection(internals: Internals, event: EventEnvelope): SubmitResult {
  if (!internals.snapshotReceived) {
    return {
      ok: false,
      reason: "guard state_refresh_received does not hold: no refreshed committed-state snapshot has been received",
      failure: null,
    };
  }
  const retried = fireTransition(internals, "retry_after_state_refresh");
  if (!retried.ok) return { ok: false, reason: retried.reason, failure: null };
  return dispatchFresh(internals, event);
}

function submitAfterMalformed(internals: Internals, event: EventEnvelope): SubmitResult {
  const retried = fireTransition(internals, "retry_with_corrected_event", event);
  if (!retried.ok) {
    return { ok: false, reason: internals.malformedReason ?? retried.reason, failure: null };
  }
  return dispatchFresh(internals, event);
}

function submitEvent(internals: Internals, event: EventEnvelope): SubmitResult {
  if (internals.unknownEffect) {
    return { ok: false, reason: unknownBlockReason(internals.unknownEffect), failure: internals.unknownEffect };
  }
  if (internals.state === "retired") {
    return {
      ok: false,
      reason: "retired_interaction: the interaction is retired; no further events are accepted",
      failure: null,
    };
  }
  if (internals.state === "applied") {
    internals.pendingNext = true;
    const continued = fireTransition(internals, "continue_after_apply");
    if (!continued.ok) return { ok: false, reason: continued.reason, failure: null };
  }
  if (internals.state === "rejected_commit") return submitAfterRejection(internals, event);
  if (internals.state === "malformed_event") return submitAfterMalformed(internals, event);
  if (internals.state === "validated") {
    const applied = fireTransition(internals, "apply_current_event");
    return applied.ok
      ? { ok: true, state: internals.state }
      : { ok: false, reason: applied.reason, failure: internals.lastFailure };
  }
  return dispatchFresh(internals, event);
}

function pollRuntime(internals: Internals): TransitionResult {
  if (internals.state !== "applied") {
    return { ok: false, reason: `poll requires the applied state, current state is ${internals.state}` };
  }
  internals.pollRequested = true;
  return fireTransition(internals, "continue_after_apply");
}

function receiveSnapshot(internals: Internals, snapshot?: CommittedState): TransitionResult {
  if (!snapshot) return { ok: false, reason: "no refreshed committed-state snapshot supplied" };
  internals.snapshotReceived = true;
  internals.refreshedState = snapshot;
  if (internals.unknownEffect) internals.unknownEffect = null;
  return { ok: true };
}

function resolveUnknown(internals: Internals, provenIdempotent: boolean): TransitionResult {
  if (!internals.unknownEffect) return { ok: false, reason: "no unknown-effect failure is pending" };
  if (!provenIdempotent) {
    return { ok: false, reason: "idempotency not proven: the unknown effect still blocks retry" };
  }
  internals.unknownEffect = null;
  return { ok: true };
}

function resumeRuntime(internals: Internals, checkpoint?: ContinuityCheckpoint): TransitionResult {
  if (!checkpoint) return { ok: false, reason: "no continuity checkpoint supplied" };
  if (!checkpointMatches(internals.committed, checkpoint)) {
    return { ok: false, reason: "checkpoint does not match committed state: reconcile before resume" };
  }
  internals.checkpoint = checkpoint;
  return { ok: true };
}

function suspendVia(internals: Internals): (reason: string) => ContinuityCheckpoint {
  return (reason) => {
    const checkpoint = suspendCheckpoint(internals.committed, reason);
    internals.checkpoint = checkpoint;
    return checkpoint;
  };
}

function attachVia(internals: Internals): (port: PersistencePort) => void {
  return (port) => {
    internals.port = port;
  };
}

function makeRuntime(internals: Internals): InteractionRuntime {
  return {
    get state() {
      return internals.state;
    },
    get committed() {
      return internals.committed;
    },
    get malformedReason() {
      return internals.malformedReason;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    get lastFailure() {
      return internals.lastFailure;
    },
    get unknownEffect() {
      return internals.unknownEffect;
    },
    get checkpoint() {
      return internals.checkpoint;
    },
    get declaredSemantics() {
      return internals.port ? internals.port.semantics : "no-persistence-port";
    },
    fire: (id, input) => fireTransition(internals, id, input),
    submit: (event) => submitEvent(internals, event),
    poll: () => pollRuntime(internals),
    receiveStateSnapshot: (snapshot) => receiveSnapshot(internals, snapshot),
    resolveUnknownEffect: (provenIdempotent) => resolveUnknown(internals, provenIdempotent),
    suspend: suspendVia(internals),
    resume: (checkpoint) => resumeRuntime(internals, checkpoint),
    attachPersistence: attachVia(internals),
  };
}

export function createInteractionRuntime(committed: CommittedState): InteractionRuntime {
  return makeRuntime({
    state: "active",
    committed,
    pendingEvent: null,
    refreshedState: null,
    snapshotReceived: false,
    pendingNext: false,
    pollRequested: false,
    rejectionReason: null,
    malformedReason: null,
    lastFailure: null,
    unknownEffect: null,
    checkpoint: null,
    port: null,
  });
}
