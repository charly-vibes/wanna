// Purpose: test fixtures for the conformance suite gate
// Responsibilities: build canonical complete manifests, manifests missing specific rows, and fix records
// Rationale: single source of shared suite vocabulary for transitions and properties tests
import type {
  ConformanceManifest,
  EdgeCaseCategory,
  FixRecord,
  ReplayFixture,
  ScenarioFixture,
  SecurityCategory,
} from "../../src/conformance-tests/types";
import { EDGE_CASE_CATEGORIES, SECURITY_CATEGORIES } from "../../src/conformance-tests/types";

export const SPEC_PROPERTY_IDS = ["p-choose-outcome", "p-confirm-gate", "p-annotate-target"] as const;

export const ADAPTER_TARGETS = ["web", "tui"] as const;

export const PINNED_VERSIONS = {
  schemaVersion: "schema-2026.10",
  catalogVersion: "catalog-2026.10",
  policyVersion: "policy-2026.10",
} as const;

function edgeScenarios(): ScenarioFixture[] {
  const rows: ScenarioFixture[] = [];
  for (const target of ADAPTER_TARGETS) {
    for (const category of EDGE_CASE_CATEGORIES) {
      rows.push({
        id: `edge-${category}-${target}-pass`,
        adapter: target,
        kind: "edge",
        category: category as EdgeCaseCategory,
        mandatory: true,
        negative: false,
      });
      rows.push({
        id: `edge-${category}-${target}-neg`,
        adapter: target,
        kind: "edge",
        category: category as EdgeCaseCategory,
        mandatory: true,
        negative: true,
      });
    }
  }
  return rows;
}

function securityScenarios(): ScenarioFixture[] {
  const rows: ScenarioFixture[] = [];
  for (const target of ADAPTER_TARGETS) {
    for (const category of SECURITY_CATEGORIES) {
      rows.push({
        id: `sec-${category}-${target}`,
        adapter: target,
        kind: "security",
        category: category as SecurityCategory,
        mandatory: true,
        negative: true,
      });
    }
  }
  return rows;
}

function versionedReplayFixtures(): ReplayFixture[] {
  return ADAPTER_TARGETS.map((target) => ({
    id: `replay-${target}`,
    schemaVersion: PINNED_VERSIONS.schemaVersion,
    catalogVersion: PINNED_VERSIONS.catalogVersion,
    policyVersion: PINNED_VERSIONS.policyVersion,
    fixtureVersion: "fixture-3",
    initialState: "session-idle",
    inputEvents: ["open:session", "choose:option-2", "commit:primary"],
  }));
}

export function completeManifest(): ConformanceManifest {
  return {
    revisionId: "rev-1",
    adapterTargets: [...ADAPTER_TARGETS],
    namedTests: [
      "choose-outcome.test.ts",
      "confirm-gate.test.ts",
      "annotate-target.test.ts",
    ],
    propertyTests: {
      "p-choose-outcome": ["choose-outcome.test.ts"],
      "p-confirm-gate": ["confirm-gate.test.ts"],
      "p-annotate-target": ["annotate-target.test.ts"],
    },
    scenarios: [...edgeScenarios(), ...securityScenarios()],
    replayFixtures: versionedReplayFixtures(),
    versions: { ...PINNED_VERSIONS },
  };
}

export function allPassOutcomes(manifest: ConformanceManifest): Record<string, "pass"> {
  const outcomes: Record<string, "pass"> = {};
  for (const scenario of manifest.scenarios) {
    if (scenario.mandatory) outcomes[scenario.id] = "pass";
  }
  return outcomes;
}

export function fixRecordFor(scenarioId: string, overrides: Partial<FixRecord> = {}): FixRecord {
  return {
    revisionId: "rev-1",
    fixedScenarioId: scenarioId,
    regressionScenarioId: `${scenarioId}-regression`,
    committed: true,
    ...overrides,
  };
}
