// Purpose: public surface of the human-authority layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createAuthorityMachine, HA_TRANSITIONS } from "./machine";
export type { AuthorityMachine } from "./machine";
export {
  approvalScopeExplicit,
  authorizationAtExecution,
  denialRequiresChange,
  isAuthoritySource,
  isRiskClass,
  isVerificationBasis,
  materialChangeInvalidates,
  AUTHORITY_LAYER_VERSION,
  MATERIAL_CHANGE_FIELDS,
} from "./invariants";
export type { Check } from "./invariants";
export {
  AUTHORITY_SOURCES,
  REQUESTER_KINDS,
  RISK_CLASSES,
  VERIFICATION_BASES,
} from "./types";
export type {
  ApprovalRecord,
  ApprovalRequest,
  AuditOutcome,
  AuditRecord,
  AuthorityGrant,
  AuthorityInput,
  AuthoritySource,
  FireArg,
  HAState,
  MaterialChange,
  RequesterKind,
  RiskClass,
  TransitionId,
  TransitionResult,
  VerificationBasis,
  VerificationClaim,
} from "./types";