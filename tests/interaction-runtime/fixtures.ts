// Purpose: test fixtures for the interaction runtime
// Responsibilities: canonical committed states and valid envelopes, plus the invalid variants corpus properties name
// Rationale: single source of shared event vocabulary for transitions and properties tests
import type { CommittedState, EventEnvelope } from "../../src/interaction-runtime/types";
import { CONTRACT_VERSION } from "../../src/interaction-runtime/types";

export function initialCommitted(overrides: Partial<CommittedState> = {}): CommittedState {
  return {
    taskId: "task-7",
    interactionId: "ix-1",
    interactionKind: "confirmation",
    contractVersion: CONTRACT_VERSION,
    interactionRevision: 2,
    taskRevision: 5,
    retired: false,
    retiredOutcome: null,
    appliedEventIds: ["ev-0"],
    responses: [],
    outcomes: [],
    ...overrides,
  };
}

export function validEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    eventId: "ev-1",
    taskId: "task-7",
    interactionId: "ix-1",
    eventType: "respond",
    contractVersion: CONTRACT_VERSION,
    interactionRevision: 2,
    taskRevision: 5,
    payload: "the assistant should summarize in three bullets",
    ...overrides,
  };
}

export function rejectionOf(result: { readonly ok: false; readonly reason: string } | { readonly ok: true }): string {
  if (result.ok) throw new Error("expected a rejection result, got acceptance");
  return result.reason;
}
