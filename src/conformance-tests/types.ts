// Purpose: vocabulary and record shapes for the conformance suite gate
// Responsibilities: suite states, transition ids, edge/security category taxonomies, manifest and fixture records
// Rationale: the gate works on typed declarations and recorded outcomes — never on inherited run results
export const SUITE_STATES = [
  "unmapped", "mapped", "running", "passed", "failed",
] as const;

export type SuiteState = (typeof SUITE_STATES)[number];

export type TransitionId =
  | "map_property_tests"
  | "begin_test_run"
  | "accept_test_run"
  | "reject_test_run"
  | "rerun_after_correction"
  | "prepare_next_release";

export const EDGE_CASE_CATEGORIES = [
  "invalid-context-contract", "zero-eligible-candidates", "deterministic-ties",
  "stale-events", "duplicate-events", "concurrent-submissions", "cancellation",
  "version-skew", "unsupported-capabilities", "host-loss", "persistence-faults",
] as const;

export type EdgeCaseCategory = (typeof EDGE_CASE_CATEGORIES)[number];

export const SECURITY_CATEGORIES = [
  "hostile-payload", "forged-event", "authorization-bypass",
  "resource-limit", "diagnostic-leak",
] as const;

export type SecurityCategory = (typeof SECURITY_CATEGORIES)[number];

export type ScenarioOutcome = "pass" | "fail" | "skipped";

export interface ScenarioFixture {
  readonly id: string;
  readonly adapter: string;
  readonly kind: "edge" | "security";
  readonly category: EdgeCaseCategory | SecurityCategory;
  readonly mandatory: boolean;
  readonly negative: boolean;
}

export interface ReplayFixture {
  readonly id: string;
  readonly schemaVersion: string;
  readonly catalogVersion: string;
  readonly policyVersion: string;
  readonly fixtureVersion: string;
  readonly initialState: string;
  readonly inputEvents: readonly string[];
}

export interface PinnedVersions {
  readonly schemaVersion: string;
  readonly catalogVersion: string;
  readonly policyVersion: string;
}

export interface ConformanceManifest {
  readonly revisionId: string;
  readonly adapterTargets: readonly string[];
  readonly namedTests: readonly string[];
  readonly propertyTests: Readonly<Record<string, readonly string[]>>;
  readonly scenarios: readonly ScenarioFixture[];
  readonly replayFixtures: readonly ReplayFixture[];
  readonly versions: PinnedVersions;
}

export interface FixRecord {
  readonly revisionId: string;
  readonly fixedScenarioId: string;
  readonly regressionScenarioId: string;
  readonly committed: boolean;
}

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };
