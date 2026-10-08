// Purpose: public surface of the interaction-security boundary
// Responsibilities: re-export the machine, checks, policy, diagnostics, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createSecurityGate, SECURITY_TRANSITIONS, SECURITY_GATE_VERSION } from "./machine";
export type { SecurityGate, TransitionRow } from "./machine";
export {
  payloadPassesSecurityValidation,
  schemaCheck,
  catalogCheck,
  sizeCheck,
  renderSafetyCheck,
  ownershipCheck,
} from "./checks";
export { buildRejectionDiagnostic } from "./diagnostics";
export type { RejectionDiagnostic } from "./diagnostics";
export {
  DEFAULT_CATALOG,
  defaultSecurityPolicy,
  catalogComponentFor,
  hostAuthorizes,
  escapeText,
  scrubSecrets,
  truncate,
  byteLength,
} from "./policy";
export { LIFECYCLE_EVENTS } from "./types";
export type {
  AgentPayload,
  Check,
  ComponentMapping,
  LifecycleEvent,
  SecurityPolicy,
  SecurityState,
  TransitionId,
  TransitionRecord,
  TransitionResult,
  TrustedOwnership,
  ValidatedInteraction,
} from "./types";
