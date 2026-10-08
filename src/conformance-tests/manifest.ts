// Purpose: manifest completeness checks for the conformance suite
// Responsibilities: property-test mapping, edge/security declaration matrix, replay versioning, adapter targets
// Rationale: every gap names its violated row so a rejected revision knows exactly what is missing
import type { ConformanceManifest, ReplayFixture, ScenarioFixture } from "./types";
import { EDGE_CASE_CATEGORIES, SECURITY_CATEGORIES } from "./types";

export function propertyTestGaps(
  specPropertyIds: readonly string[],
  manifest: ConformanceManifest,
): string[] {
  const unmapped = specPropertyIds.filter(
    (id) => (manifest.propertyTests[id]?.length ?? 0) === 0,
  );
  const unknown = specPropertyIds.flatMap((id) =>
    (manifest.propertyTests[id] ?? [])
      .filter((test) => !manifest.namedTests.includes(test))
      .map((test) => `property ${id} references unknown test ${test}`),
  );
  return [
    ...unmapped.map((id) => `property ${id} has no mapped test`),
    ...unknown,
  ];
}

function categoryDeclared(
  scenarios: readonly ScenarioFixture[],
  target: string,
  kind: "edge" | "security",
  category: string,
): boolean {
  return scenarios.some(
    (s) => s.adapter === target && s.kind === kind && s.category === category,
  );
}

type GapText = (category: string, target: string) => string;

function categoryGaps(
  scenarios: readonly ScenarioFixture[],
  targets: readonly string[],
  kind: "edge" | "security",
  categories: readonly string[],
  gapText: GapText,
): string[] {
  const gaps: string[] = [];
  for (const target of targets) {
    for (const category of categories) {
      if (!categoryDeclared(scenarios, target, kind, category)) {
        gaps.push(gapText(category, target));
      }
    }
  }
  return gaps;
}

export function edgeMatrixGaps(
  scenarios: readonly ScenarioFixture[],
  targets: readonly string[],
): string[] {
  const positive = (target: string, category: string): boolean =>
    scenarios.some(
      (s) => s.adapter === target && s.kind === "edge" && s.category === category && !s.negative,
    );
  const negative = (target: string, category: string): boolean =>
    scenarios.some(
      (s) => s.adapter === target && s.kind === "edge" && s.category === category && s.negative,
    );
  const gaps: string[] = [];
  for (const target of targets) {
    for (const category of EDGE_CASE_CATEGORIES) {
      if (!positive(target, category)) {
        gaps.push(`edge category ${category} on target ${target} has no passing fixture`);
      }
      if (!negative(target, category)) {
        gaps.push(`edge category ${category} on target ${target} has no applicable negative fixture`);
      }
    }
  }
  return gaps;
}

export function securityMatrixGaps(
  scenarios: readonly ScenarioFixture[],
  targets: readonly string[],
): string[] {
  const gapText: GapText = (category, target) =>
    `security category ${category} on target ${target} has no scenario group`;
  return categoryGaps(scenarios, targets, "security", SECURITY_CATEGORIES, gapText);
}

export function replayFixtureIssues(fixture: ReplayFixture): string[] {
  const fields = ["schemaVersion", "catalogVersion", "policyVersion", "fixtureVersion", "initialState"] as const;
  const missing = fields.filter((f) => fixture[f].length === 0).map((f) => `missing ${f}`);
  if (fixture.inputEvents.length === 0) {
    return [...missing, "input events must be an ordered non-empty sequence"];
  }
  return missing;
}

function replayGaps(manifest: ConformanceManifest): string[] {
  if (manifest.replayFixtures.length === 0) return ["no versioned replay fixtures"];
  return manifest.replayFixtures.flatMap((fixture) => {
    const issues = replayFixtureIssues(fixture);
    if (issues.length === 0) return [];
    return [`replay fixture ${fixture.id} is missing required version/initial-state fields: ${issues.join(", ")}`];
  });
}

export function manifestGaps(
  manifest: ConformanceManifest,
  specPropertyIds: readonly string[],
): string[] {
  const gaps: string[] = [];
  if (manifest.adapterTargets.length === 0) gaps.push("no declared adapter targets");
  gaps.push(...propertyTestGaps(specPropertyIds, manifest));
  const edgeText: GapText = (category, target) => `edge scenario category ${category} missing on target ${target}`;
  const securityText: GapText = (category, target) =>
    `security scenario category ${category} missing on target ${target}`;
  gaps.push(...categoryGaps(manifest.scenarios, manifest.adapterTargets, "edge", EDGE_CASE_CATEGORIES, edgeText));
  gaps.push(...categoryGaps(manifest.scenarios, manifest.adapterTargets, "security", SECURITY_CATEGORIES, securityText));
  gaps.push(...replayGaps(manifest));
  return gaps;
}
