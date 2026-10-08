// Purpose: test fixtures for the interaction-contract layer
// Responsibilities: build canonical valid contracts, per-kind payloads, and correlated responses
// Rationale: single source of shared contract vocabulary for transitions and properties tests
import { KIND_CONTRACT_SCHEMAS } from "../../src/interaction-contract/registries";
import { CONTRACT_SCHEMA_VERSION } from "../../src/interaction-contract/types";
import type { ContractResponse, InteractionContract } from "../../src/interaction-contract/types";

export const CHOOSE = "choose";

export function kindSchema(kind: string) {
  // unknown kinds fall back to the canonical kind's payload shape — the fixture
  // still builds a coherent record; allowlist validation rejects the kind itself
  return KIND_CONTRACT_SCHEMAS[kind as keyof typeof KIND_CONTRACT_SCHEMAS] ?? KIND_CONTRACT_SCHEMAS[CHOOSE];
}

export function payloadForKind(kind: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of kindSchema(kind).requiredPayloadFields) {
    payload[field] = `the ${field} for this interaction`;
  }
  if (kind === "choose" || kind === "rank") {
    payload["options"] = [
      { id: "opt-1", value: "Option A" },
      { id: "opt-2", value: "Option B" },
    ];
  }
  payload["label"] = "A canonical contract label";
  return payload;
}

export function fullAccessibility(): InteractionContract["accessibility"] {
  return {
    naming: "the label announces the request",
    operation: "every control is keyboard operable",
    focusNavigation: "focus order follows the declared option order",
    statusErrors: "status and errors are announced as text",
    timing: null,
  };
}

export function fullEscapePaths(): InteractionContract["escapePaths"] {
  return {
    reject: "the workflow returns to the requesting step",
    defer: "the request returns to the queue",
    cancel: "the interaction closes without a substantive response",
    dismiss: "the prompt closes without a substantive response",
    timeout: "silence is recorded and may re-prompt per policy",
  };
}

export function validContract(overrides: Partial<InteractionContract> = {}): InteractionContract {
  const kind = overrides.kind ?? CHOOSE;
  const schema = kindSchema(kind);
  return {
    interactionId: "ix-contract-1",
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    interactionRevision: "rev-1",
    taskId: "task-7",
    taskRevisionPrecondition: "task-7",
    kind,
    contribution: { primitive: "select" },
    payload: payloadForKind(kind),
    responseSchema: { requiredFields: [...schema.responseFields], outcomeVocabulary: ["submitted"] },
    accessibility: fullAccessibility(),
    escapePaths: fullEscapePaths(),
    ...overrides,
  };
}

export function responseFor(contract: InteractionContract, overrides: Partial<ContractResponse> = {}): ContractResponse {
  const fields: Record<string, unknown> = {};
  for (const field of contract.responseSchema.requiredFields) {
    fields[field] = "a response value";
  }
  return {
    interactionId: contract.interactionId,
    schemaVersion: contract.schemaVersion,
    interactionRevision: contract.interactionRevision,
    taskRevisionPrecondition: contract.taskRevisionPrecondition,
    eventId: "evt-1",
    fields,
    ...overrides,
  };
}