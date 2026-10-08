// Purpose: public surface of the interaction amplification policy
// Responsibilities: re-export the machine, evaluation, invariants, and types under one entry point
// Rationale: callers import from the capability, never from internals
export {
  AMPLIFICATION_TRANSITIONS,
  createAmplificationPolicy,
} from "./machine";
export type { AmplificationPolicyMachine, TransitionRow } from "./machine";
export { POLICY_VERSION, SCORING_POLICY_VERSION } from "./types";
export { evaluateCandidates } from "./evaluate";
export {
  REASON_CODES,
  RISK_CLASS_ASSURANCE_FLOOR,
  RISK_CLASS_REVIEW_BASELINE,
  REVIEW_LEVEL_ORDER,
  contextDigest,
  evidenceEscalation,
  hardPreferencesUnmet,
  isSoftPreference,
  requiredReviewLevel,
  softAffinity,
} from "./invariants";
export type {
  AmplificationCandidate,
  AmplificationDecision,
  AmplificationState,
  DecisionEntry,
  EvidenceState,
  NormalizedContext,
  PolicyContext,
  PreferenceKind,
  ReasonCode,
  ReviewLevel,
  RiskClass,
  TransitionId,
  TransitionResult,
  UserPreference,
} from "./types";
