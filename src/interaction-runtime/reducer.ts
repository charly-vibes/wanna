// Purpose: the pure event reducer for the interaction runtime
// Responsibilities: reduce a validated event against committed state — accepted mutation or typed rejection, plus replay over an accepted log
// Rationale: the reducer is deterministic and pure; clock reads, randomness, network, and persistence stay outside it
import type { CommittedState, EventEnvelope, LifecycleEventType, Reduction } from "./types";
import { EVENT_TYPES, OUTCOME_OF } from "./types";
import { envelopeValid } from "./envelope";
import { commitPreconditionsSatisfied } from "./preconditions";

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

export function isLifecycle(eventType: string): eventType is LifecycleEventType {
  return eventType !== "respond" && EVENT_TYPE_SET.has(eventType);
}

function acceptLifecycle(state: CommittedState, event: EventEnvelope): CommittedState {
  const outcome = OUTCOME_OF[event.eventType as LifecycleEventType];
  return {
    ...state,
    retired: true,
    retiredOutcome: outcome,
    interactionRevision: state.interactionRevision + 1,
    appliedEventIds: [...state.appliedEventIds, event.eventId],
    outcomes: [...state.outcomes, { eventId: event.eventId, outcome }],
  };
}

function acceptResponse(state: CommittedState, event: EventEnvelope): CommittedState {
  return {
    ...state,
    interactionRevision: state.interactionRevision + 1,
    appliedEventIds: [...state.appliedEventIds, event.eventId],
    responses: [...state.responses, { eventId: event.eventId, payload: event.payload as string }],
  };
}

function acceptEvent(state: CommittedState, event: EventEnvelope): CommittedState {
  return isLifecycle(event.eventType) ? acceptLifecycle(state, event) : acceptResponse(state, event);
}

export function reduceEvent(state: CommittedState, event: EventEnvelope): Reduction {
  const envelope = envelopeValid(event);
  if (!envelope.ok) {
    return { ok: false, reason: envelope.reason, transition: "reject_malformed_envelope", phase: "envelope" };
  }
  const preconditions = commitPreconditionsSatisfied(state, event);
  if (!preconditions.ok) {
    return { ok: false, reason: preconditions.reason, transition: "reject_stale_or_duplicate", phase: "preconditions" };
  }
  return {
    ok: true,
    next: acceptEvent(state, event),
    transition: isLifecycle(event.eventType) ? "retire_interaction" : "apply_current_event",
  };
}

export interface ReplayResult {
  readonly committed: CommittedState;
  readonly rejected: readonly { readonly eventId: string; readonly reason: string }[];
}

export function replayLog(initial: CommittedState, events: readonly EventEnvelope[]): ReplayResult {
  let committed = initial;
  const rejected: { eventId: string; reason: string }[] = [];
  for (const event of events) {
    const reduction = reduceEvent(committed, event);
    if (reduction.ok) {
      committed = reduction.next;
    } else {
      rejected.push({ eventId: event.eventId, reason: reduction.reason });
    }
  }
  return { committed, rejected };
}
