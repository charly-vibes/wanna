// Purpose: shared fixtures for cognitive-ergonomics tests
// Responsibilities: build well-formed adaptation requests and presentation records; tests vary one field at a time
// Rationale: single source of shared vocabulary so guard failures name the single varied cause
import type {
  ActionIdentity,
  AdaptationDesign,
  AdaptationRequest,
  ConfidenceSource,
  InferredState,
  InterruptionClaim,
  OptionSet,
  PresentationSpec,
} from "../../src/cognitive-ergonomics/types";

/** Shallow-override merge (assignment form) for state claims. */
function withOverrides<T>(base: T, overrides: Partial<T>): T {
  return Object.assign({}, base, overrides);
}

/** Structured-literal merge for surface specs. */
function mergedWith<T>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides };
}

/** Frozen-literal merge for identity records. */
function frozenWith<T>(base: T, overrides: Partial<T>): T {
  return Object.freeze({ ...base, ...overrides }) as T;
}

export function measurableTrigger() {
  return { metric: "choice_count" as const, value: 9, evidenceRef: "ev-1" };
}

export function inferredState(overrides: Partial<InferredState> = {}): InferredState {
  return withOverrides(
    {    attribute: "confusion",
    estimate: 0.7,
    uncertain: true,
    evidenceRefs: ["ev-2"],},
    overrides,
  );
}

export function adaptation(overrides: Partial<AdaptationDesign> = {}): AdaptationDesign {
  return {
    adaptationId: "adapt-1",
    measurableTriggers: [measurableTrigger()],
    inferredStates: [],
    replacesSurfaceDuringEntry: false,
    safetyRequired: false,
    userAccepted: false,
    reason: "reduces required recall from nine tokens to two",
    override: { kind: "revert", available: true },
    ...overrides,
  };
}

export function request(overrides: Partial<AdaptationRequest> = {}): AdaptationRequest {
  return { adaptation: adaptation(), ...overrides };
}

export function interruption(overrides: Partial<InterruptionClaim> = {}): InterruptionClaim {
  return withOverrides(
    {    need: "clarify scope before destructive apply",
    expectedBenefit: "prevents irreversible data loss",
    urgency: "deadline in two hours",
    deferralRationale: "deferral risks an uninformed destructive apply",},
    overrides,
  );
}

export function presentation(overrides: Partial<PresentationSpec> = {}): PresentationSpec {
  return mergedWith(
    {    surface: "deployment-target-picker",
    exposes: [
      { label: "staging", context: "current target" },
      { label: "production", context: "requires approval" },
    ],
    requiresRecallOf: [],
    equivalentExposeAvailable: false,
    feasible: true,},
    overrides,
  );
}

export function optionSet(overrides: Partial<OptionSet> = {}): OptionSet {
  return mergedWith(
    {    surface: "region-picker",
    optionCount: 6,
    heterogeneous: false,
    strategy: undefined,
    strategyDocumented: false,},
    overrides,
  );
}

export function actionIdentity(overrides: Partial<ActionIdentity> = {}): ActionIdentity {
  return frozenWith(
    {    semanticId: "deploy.rollback",
    frequentlyUsed: true,
    consequential: true,
    placements: [
      { host: "cli", visualPlacement: "top-level", semanticIdAtHost: "deploy.rollback" },
      { host: "web", visualPlacement: "overflow-menu", semanticIdAtHost: "deploy.rollback" },
    ],},
    overrides,
  );
}

export function confidenceSource(overrides: Partial<ConfidenceSource> = {}): ConfidenceSource {
  return frozenWith(
    {    metric: "schema_validity",
    semantics: "probability the proposal passes the canonical schema",
    evidenceRefs: ["ev-3"],},
    overrides,
  );
}
