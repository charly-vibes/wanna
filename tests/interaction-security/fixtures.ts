// Purpose: test fixtures for the interaction-security gate
// Responsibilities: build the trusted policy/catalog/ownership inputs and the canonical agent payload variants
// Rationale: trusted inputs are frozen so tests can prove agent content never mutates policy or tools
import {
  DEFAULT_CATALOG,
  defaultSecurityPolicy,
} from "../../src/interaction-security/policy";
import type {
  AgentPayload,
  ComponentMapping,
  SecurityPolicy,
  TrustedOwnership,
} from "../../src/interaction-security/types";

export function trustedPolicy(): SecurityPolicy {
  return defaultSecurityPolicy();
}

export function trustedCatalog(): readonly ComponentMapping[] {
  return DEFAULT_CATALOG;
}

export function trustedOwnership(
  overrides: Partial<TrustedOwnership> = {},
): TrustedOwnership {
  return {
    taskRevision: "task-7",
    sessionId: "session-1",
    interactionId: "ix-1",
    currentRevision: 3,
    ...overrides,
  };
}

export function agentPayload(overrides: Partial<AgentPayload> = {}): AgentPayload {
  return {
    kind: "confirm",
    label: "Approve the deployment?",
    options: ["Approve", "Cancel"],
    taskRevision: "task-7",
    sessionId: "session-1",
    interactionId: "ix-1",
    revision: 3,
    ...overrides,
  };
}
