// Purpose: conformance suite state machine
// Responsibilities: the six [[spec]] transitions (map, begin, accept, reject, rerun, prepare-next-release) with their guards
// Rationale: pass status is bound to the revision that earned it — no inherited results, no skipped targets passing
import type {
  ConformanceManifest,
  FixRecord,
  ScenarioFixture,
  ScenarioOutcome,
  SuiteState,
  TransitionId,
  TransitionResult,
} from "./types";
import { manifestGaps } from "./manifest";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: SuiteState;
  readonly to: SuiteState;
}

export const SUITE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "map_property_tests", from: "unmapped", to: "mapped" },
  { id: "begin_test_run", from: "mapped", to: "running" },
  { id: "accept_test_run", from: "running", to: "passed" },
  { id: "reject_test_run", from: "running", to: "failed" },
  { id: "rerun_after_correction", from: "failed", to: "mapped" },
];

export interface GateSubmission {
  readonly revisionId: string;
  readonly manifest: ConformanceManifest;
  readonly specPropertyIds: readonly string[];
  readonly fixRecords?: readonly FixRecord[];
}

export interface ConformanceGate {
  readonly revisionId: string;
  readonly state: SuiteState;
  readonly lastPassedRevision: string | null;
  readonly findings: readonly string[];
  fire(id: TransitionId): TransitionResult;
  recordOutcomes(outcomes: Readonly<Record<string, ScenarioOutcome>>): TransitionResult;
  prepare(nextRevisionId: string): TransitionResult;
  passStatus(revisionId: string): "passed" | "stale";
}

interface Offender {
  readonly scenario: ScenarioFixture;
  readonly outcome: ScenarioOutcome | "unrecorded";
}

interface Internals {
  state: SuiteState;
  revisionId: string;
  manifest: ConformanceManifest;
  specPropertyIds: readonly string[];
  fixRecords: readonly FixRecord[];
  outcomes: Readonly<Record<string, ScenarioOutcome>>;
  findings: readonly string[];
  lastPassedRevision: string | null;
}

function effectiveOutcome(
  outcomes: Readonly<Record<string, ScenarioOutcome>>,
  scenarioId: string,
): ScenarioOutcome | "unrecorded" {
  return outcomes[scenarioId] ?? "unrecorded";
}

function passOffenders(
  manifest: ConformanceManifest,
  outcomes: Readonly<Record<string, ScenarioOutcome>>,
): Offender[] {
  return manifest.scenarios
    .filter((scenario) => scenario.mandatory)
    .map((scenario) => ({ scenario, outcome: effectiveOutcome(outcomes, scenario.id) }))
    .filter((entry) => entry.outcome !== "pass");
}

function findingText(offender: Offender): string {
  return `mandatory scenario ${offender.scenario.id} on target ${offender.scenario.adapter} is ${offender.outcome}`;
}

function hasCommittedFix(records: readonly FixRecord[], scenarioId: string): boolean {
  return records.some(
    (r) => r.committed && r.fixedScenarioId === scenarioId && r.regressionScenarioId.length > 0,
  );
}

function mapGuard(internals: Internals): TransitionResult {
  const ids = internals.specPropertyIds.filter((id) => {
    const tests = internals.manifest.propertyTests[id] ?? [];
    return tests.length === 0 || tests.some((t) => !internals.manifest.namedTests.includes(t));
  });
  if (ids.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `guard every_property_mapped_to_test does not hold: unmapped properties ${ids.join(", ")}`,
  };
}

function beginGuard(internals: Internals): TransitionResult {
  const gaps = manifestGaps(internals.manifest, internals.specPropertyIds);
  if (gaps.length === 0) return { ok: true };
  return { ok: false, reason: `guard suite_manifest_complete does not hold: ${gaps.join("; ")}` };
}

function acceptGuard(internals: Internals): TransitionResult {
  const offenders = passOffenders(internals.manifest, internals.outcomes);
  if (offenders.length === 0) return { ok: true };
  const first = offenders.find((o) => o.outcome !== "unrecorded") ?? offenders[0]!;
  return { ok: false, reason: `guard test_suite_passed does not hold: ${findingText(first)}` };
}

function rejectGuard(internals: Internals): TransitionResult {
  if (acceptGuard(internals).ok) {
    return { ok: false, reason: "reject_test_run requires test_suite_passed to not hold" };
  }
  return { ok: true };
}

function rerunGuard(internals: Internals): TransitionResult {
  const offenders = passOffenders(internals.manifest, internals.outcomes)
    .filter((o) => o.outcome !== "unrecorded");
  const unfixable = offenders.find((o) => !hasCommittedFix(internals.fixRecords, o.scenario.id));
  if (!unfixable) return { ok: true };
  return {
    ok: false,
    reason: `guard fix_committed does not hold: scenario ${unfixable.scenario.id} has no committed fix and retained regression case`,
  };
}

function guardCheck(internals: Internals, id: TransitionId): TransitionResult {
  if (id === "map_property_tests") return mapGuard(internals);
  if (id === "begin_test_run") return beginGuard(internals);
  if (id === "accept_test_run") return acceptGuard(internals);
  if (id === "reject_test_run") return rejectGuard(internals);
  return rerunGuard(internals);
}

function applyEffect(internals: Internals, id: TransitionId, to: SuiteState): void {
  internals.state = to;
  if (id === "begin_test_run") internals.outcomes = {};
  if (id === "accept_test_run") internals.lastPassedRevision = internals.revisionId;
  if (id === "reject_test_run") {
    internals.findings = passOffenders(internals.manifest, internals.outcomes).map(findingText);
  }
  if (id === "rerun_after_correction") internals.findings = [];
}

function unknownOrPrepare(id: TransitionId): TransitionResult {
  if (id === "prepare_next_release") {
    return {
      ok: false,
      reason: "prepare_next_release takes a new revision id — call prepare(nextRevisionId)",
    };
  }
  return { ok: false, reason: `unknown transition ${id}` };
}

function fireTransition(internals: Internals, id: TransitionId): TransitionResult {
  const row = SUITE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return unknownOrPrepare(id);
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardCheck(internals, id);
  if (!guard.ok) return guard;
  applyEffect(internals, id, row.to);
  return { ok: true };
}

function recordOutcomes(
  internals: Internals,
  outcomes: Readonly<Record<string, ScenarioOutcome>>,
): TransitionResult {
  if (internals.state !== "running") {
    return {
      ok: false,
      reason: `outcomes can only be recorded while the suite is running (state ${internals.state})`,
    };
  }
  internals.outcomes = { ...internals.outcomes, ...outcomes };
  return { ok: true };
}

function prepareTransition(internals: Internals, next: string): TransitionResult {
  if (internals.state !== "passed") {
    return { ok: false, reason: `transition prepare_next_release cannot fire from state ${internals.state}` };
  }
  if (next.length === 0 || next === internals.revisionId) {
    return {
      ok: false,
      reason: `guard new_release_candidate does not hold: no new revision submitted (revision ${internals.revisionId} unchanged)`,
    };
  }
  internals.lastPassedRevision = internals.revisionId;
  internals.revisionId = next;
  internals.state = "unmapped";
  internals.outcomes = {};
  internals.findings = [];
  return { ok: true };
}

function makeMachine(internals: Internals): ConformanceGate {
  return {
    get revisionId() {
      return internals.revisionId;
    },
    get state() {
      return internals.state;
    },
    get lastPassedRevision() {
      return internals.lastPassedRevision;
    },
    get findings() {
      return internals.findings;
    },
    fire: (id) => fireTransition(internals, id),
    recordOutcomes: (outcomes) => recordOutcomes(internals, outcomes),
    prepare: (next) => prepareTransition(internals, next),
    passStatus: (revisionId) => (revisionId === internals.lastPassedRevision ? "passed" : "stale"),
  };
}

export function createConformanceGate(submission: GateSubmission): ConformanceGate {
  const internals: Internals = {
    state: "unmapped",
    revisionId: submission.revisionId,
    manifest: submission.manifest,
    specPropertyIds: submission.specPropertyIds,
    fixRecords: submission.fixRecords ?? [],
    outcomes: {},
    findings: [],
    lastPassedRevision: null,
  };
  return makeMachine(internals);
}
