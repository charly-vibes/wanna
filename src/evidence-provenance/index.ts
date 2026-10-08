// Purpose: public surface of the evidence and provenance layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createEvidenceLayer } from "./machine";
export type { EvidenceLayer } from "./machine";
export {
  EVIDENCE_CLASSES,
  EVIDENCE_TRANSITIONS,
  EXPLICIT_EVIDENCE_STATUSES,
  NORMATIVE_STRENGTHS,
} from "./types";
export type {
  AppliedTransition,
  AuditEntry,
  Check,
  EvidenceClass,
  EvidenceProposal,
  EvidenceState,
  EvidenceStatus,
  FireArg,
  ImportedClaim,
  ModelProposalRecord,
  NormativeStrength,
  RedactionPolicy,
  ReviewRecord,
  TransitionId,
  TransitionResult,
  TransitionRow,
} from "./types";
export {
  auditRecordsAppendOnly,
  evidenceClassRecorded,
  evidenceHasIdentity,
  modelProposalAttributed,
  reviewActionAttributed,
  sensitiveDataMinimized,
  sourceQualityNotNormativity,
  transformationsLinked,
  unknownEvidenceExplicit,
} from "./invariants";
