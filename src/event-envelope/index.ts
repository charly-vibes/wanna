// Purpose: public surface of the event-envelope layer
// Responsibilities: re-export the machine, reducer, schema, bounds, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createEnvelopeMachine, ENVELOPE_TRANSITIONS, ENVELOPE_VERSION } from "./machine";
export type { EnvelopeMachine, TransitionRow } from "./machine";
export { reduceEvent } from "./reducer";
export type { ReduceOutcome } from "./reducer";
export { originCorrelated, payloadSchemaChecked } from "./schema";
export { payloadWithinBounds } from "./bounds";
export { DECLARED_EVENT_TYPES, PAYLOAD_BOUNDS, RESULT_CODES } from "./types";
export type {
  Check,
  EffectIntent,
  EnvelopeContext,
  EnvelopeState,
  EventType,
  EventEnvelope,
  ResultCode,
  TransitionId,
  TransitionResult,
} from "./types";