// Purpose: public surface of the interaction-policy layer
// Responsibilities: re-export the machine, invariants, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createPolicyMachine, POLICY_TRANSITIONS } from "./machine";
export type { PolicyMachine, TransitionRow } from "./machine";
export {
  REASON_CODES,
  adaptationStable,
  authorizeWithRecommendation,
  buildResult,
  contextChanged,
  countEligible,
  exclusionsFor,
  gateCandidate,
  interruptionJustified,
  policyInputValid,
  rankCandidates,
} from "./invariants";
export type { Check } from "./invariants";
export {
  MAX_RECOMMENDATIONS_CEILING,
  POLICY_VERSION,
  TIE_BREAK_RULE_VERSION,
} from "./types";
export type {
  AdaptationDeclaration,
  AuthorizationRequest,
  BurdenAttribute,
  CatalogPin,
  Check,
  ContextPin,
  EvaluationOutcome,
  ExcludedCandidate,
  InterruptionJustification,
  NormalizedNeedRecord,
  PolicyCandidate,
  PolicyInput,
  PolicyResult,
  PolicyState,
  Recommendation,
  TransitionId,
  TransitionResult,
} from "./types";