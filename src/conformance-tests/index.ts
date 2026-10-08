// Purpose: public surface of the conformance-tests capability
// Responsibilities: re-export the machine, manifest checks, semantics, reports, and claim gates under one entry point
// Rationale: callers import from the capability, never from internals
export { createConformanceGate, SUITE_TRANSITIONS } from "./machine";
export type { ConformanceGate, GateSubmission, TransitionRow } from "./machine";
export {
  propertyTestGaps,
  edgeMatrixGaps,
  securityMatrixGaps,
  replayFixtureIssues,
  manifestGaps,
} from "./manifest";
export { normalizeEvents, adapterSemanticsMatch } from "./semantics";
export type { HostAnswer, SemanticMatch } from "./semantics";
export { buildFailureReport, failureReportIssues } from "./reports";
export type { FailureReport, FailureReportInput } from "./reports";
export {
  blockedClaims,
  baselineGaps,
  usabilityAfterMachinePass,
  recordUsabilityStatus,
  acceptanceStatus,
  empiricalClaimVerdict,
  EMPIRICAL_OUTCOMES,
} from "./claims";
export type {
  QualityClaim,
  GateResult,
  UsageClaimKind,
  UsageClaim,
  MeasurementSet,
  UsabilityStatus,
  UsabilityEvidence,
  AcceptanceStatus,
  AcceptanceInput,
  EmpiricalClaim,
  EmpiricalVerdict,
} from "./claims";
export {
  SUITE_STATES,
  EDGE_CASE_CATEGORIES,
  SECURITY_CATEGORIES,
} from "./types";
export type {
  SuiteState,
  TransitionId,
  EdgeCaseCategory,
  SecurityCategory,
  ScenarioOutcome,
  ScenarioFixture,
  ReplayFixture,
  PinnedVersions,
  ConformanceManifest,
  FixRecord,
  TransitionResult,
} from "./types";
