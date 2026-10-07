// Purpose: test fixtures for the session-state machine
// Responsibilities: build canonical environments, pending interactions, and serialized session records
// Rationale: single source of shared session vocabulary for transitions and properties tests
import { createSession } from "../../src/session-state/machine";
import type {
  PendingInteraction,
  SessionEnvironment,
} from "../../src/session-state/types";

export const ENV: SessionEnvironment = {
  policyVersion: "policy-2026.10",
  supportedContractRevisions: ["contract-1", "contract-2"],
};

export function pendingInteraction(
  overrides: Partial<PendingInteraction> = {},
): PendingInteraction {
  return {
    interactionId: "int-1",
    taskRevision: "task-7",
    contractRevision: "contract-1",
    ...overrides,
  };
}

export function freshSession(sessionId = "session-1") {
  return createSession(sessionId, ENV);
}

export function serializedSession(sessionId = "session-1"): string {
  const m = freshSession(sessionId);
  m.recordPending(pendingInteraction());
  return m.serialize();
}

export function tamperSerialized(raw: string, mutate: (r: Record<string, unknown>) => void): string {
  const record = JSON.parse(raw) as Record<string, unknown>;
  mutate(record);
  return JSON.stringify(record);
}
