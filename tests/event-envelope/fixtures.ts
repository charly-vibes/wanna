// Purpose: test fixtures for the event-envelope layer
// Responsibilities: build canonical valid envelopes, contexts, and the invalid variants the corpus properties name
// Rationale: single source of shared envelope vocabulary for transitions and properties tests
import type { EnvelopeContext, EventEnvelope } from "../../src/event-envelope/types";

export function validEnvelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: "evt-1",
    eventType: "response.delivered",
    source: "host",
    sessionId: "sess-1",
    taskId: "task-7",
    interactionId: "ix-1",
    contractRevision: "contract-3",
    expectedTaskRevision: "task-7",
    payload: { message: "ok" },
    ...overrides,
  };
}

export function validContext(overrides: Partial<EnvelopeContext> = {}): EnvelopeContext {
  return {
    committedEventIds: [],
    currentTaskRevision: "task-7",
    authorizedSources: ["host", "user"],
    ...overrides,
  };
}