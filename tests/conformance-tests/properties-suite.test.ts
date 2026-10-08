// Purpose: property tests for the conformance suite mechanics
// Responsibilities: corpus properties of conformance-tests as vitest tests; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/conformance-tests/*.toml to these tests via `vitest run -t '<description>'`
import { describe, it, expect } from "vitest";
import {
  EDGE_CASE_CATEGORIES,
  SECURITY_CATEGORIES,
  adapterSemanticsMatch,
  edgeMatrixGaps,
  failureReportIssues,
  manifestGaps,
  propertyTestGaps,
  replayFixtureIssues,
  securityMatrixGaps,
  buildFailureReport,
} from "../../src/conformance-tests/index";
import type { FailureReport, ReplayFixture } from "../../src/conformance-tests/index";
import {
  ADAPTER_TARGETS,
  PINNED_VERSIONS,
  SPEC_PROPERTY_IDS,
  allPassOutcomes,
  completeManifest,
} from "./fixtures";
import { createConformanceGate } from "../../src/conformance-tests/machine";

describe("conformance-tests suite properties", () => {
  it("TypeScript CI test: every feature-spec Property ID resolves to at least one existing named test", () => {
    const manifest = completeManifest();
    // the canonical mapping resolves for every declared property
    expect(propertyTestGaps([...SPEC_PROPERTY_IDS], manifest)).toEqual([]);
    // a dropped mapping leaves a gap naming the property
    const orphaned = { ...manifest, propertyTests: { "p-choose-outcome": ["choose-outcome.test.ts"] } };
    expect(propertyTestGaps([...SPEC_PROPERTY_IDS], orphaned)).toEqual([
      "property p-confirm-gate has no mapped test",
      "property p-annotate-target has no mapped test",
    ]);
    // a mapping referencing a test that does not exist also leaves a gap naming the test
    const dangling = {
      ...manifest,
      propertyTests: { "p-choose-outcome": ["choose-outcome.test.ts", "never-written.test.ts"] },
    };
    expect(propertyTestGaps([...SPEC_PROPERTY_IDS], dangling)).toEqual([
      "property p-confirm-gate has no mapped test",
      "property p-annotate-target has no mapped test",
      "property p-choose-outcome references unknown test never-written.test.ts",
    ]);
  });

  it("TypeScript CI test: semantically equivalent web/TUI answers reduce to equivalent core events and outcomes", () => {
    // the same intent expressed through two hosts reduces to identical core semantics
    const web = { adapter: "web" as const, events: ["pointer-select:option-2", "click:primary"] };
    const tui = { adapter: "tui" as const, events: ["move-down:option-2", "enter:primary"] };
    expect(adapterSemanticsMatch([web, tui])).toEqual({
      ok: true,
      normalized: ["choose:option-2", "commit:primary"],
    });
    // different intent reduces to different semantics — mismatch is named, not masked
    const other = { adapter: "tui" as const, events: ["move-down:option-3", "enter:primary"] };
    const mismatch = adapterSemanticsMatch([web, other]);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.reason).toContain("event 0");
  });

  it("TypeScript CI test: each required edge-case category has at least one passing and one applicable negative fixture", () => {
    const manifest = completeManifest();
    expect(edgeMatrixGaps(manifest.scenarios, [...ADAPTER_TARGETS])).toEqual([]);
    // drop the negative fixture for one category on one target — the gap names both
    const thin = manifest.scenarios.filter((s) => s.id !== "edge-cancellation-web-neg");
    expect(edgeMatrixGaps(thin, [...ADAPTER_TARGETS])).toEqual([
      "edge category cancellation on target web has no applicable negative fixture",
    ]);
    // drop all fixtures for one category — the gap names both the missing pass and the missing negative
    const noPass = manifest.scenarios.filter((s) => !s.id.startsWith("edge-version-skew-"));
    expect(edgeMatrixGaps(noPass, [...ADAPTER_TARGETS])).toEqual([
      "edge category version-skew on target web has no passing fixture",
      "edge category version-skew on target web has no applicable negative fixture",
      "edge category version-skew on target tui has no passing fixture",
      "edge category version-skew on target tui has no applicable negative fixture",
    ]);
    expect(EDGE_CASE_CATEGORIES.length).toBe(11);
  });

  it("TypeScript CI test: replay fixture without required version/initial-state fields is rejected", () => {
    const versioned: ReplayFixture = {
      id: "replay-web",
      schemaVersion: "schema-1",
      catalogVersion: "catalog-1",
      policyVersion: "policy-1",
      fixtureVersion: "fixture-1",
      initialState: "session-idle",
      inputEvents: ["open:session", "commit:primary"],
    };
    expect(replayFixtureIssues(versioned)).toEqual([]);
    // strip a required field — rejection names the missing field
    const stripped = { ...versioned, policyVersion: "", inputEvents: [] };
    expect(replayFixtureIssues(stripped)).toEqual([
      "missing policyVersion",
      "input events must be an ordered non-empty sequence",
    ]);
  });

  it("CI configuration test: security scenario groups run for each declared adapter target", () => {
    const manifest = completeManifest();
    expect(securityMatrixGaps(manifest.scenarios, [...ADAPTER_TARGETS])).toEqual([]);
    // one security group missing on one target blocks the matrix for that target
    const thin = manifest.scenarios.filter((s) => s.id !== "sec-resource-limit-tui");
    expect(securityMatrixGaps(thin, [...ADAPTER_TARGETS])).toEqual([
      "security category resource-limit on target tui has no scenario group",
    ]);
    expect(SECURITY_CATEGORIES.length).toBe(5);
  });

  it("TypeScript CI test: failure report records stable scenario/test identity and the pinned versions needed for reproduction", () => {
    const report = buildFailureReport({
      testId: "edge-cancellation-web-pass",
      fixtureId: "replay-web",
      versions: { ...PINNED_VERSIONS },
      expected: "cancellation acknowledged, no further events accepted",
      actual: "post-cancel commit was accepted",
      minimizedReproduction: "replay replay-web with events [open:session, cancel:op-1, commit:primary]",
    });
    expect(failureReportIssues(report)).toEqual([]);
    const thin: FailureReport = {
      ...report,
      testId: "",
      catalogVersion: "",
      minimizedReproduction: null,
    };
    // identity and pinned versions are required; minimized reproduction stays optional (where supported)
    expect(failureReportIssues(thin)).toEqual(["missing testId", "missing catalogVersion"]);
  });

  it("TypeScript CI test: a missing mapped property, edge/security scenario, replay version or adapter target blocks a passing result", () => {
    const manifest = completeManifest();
    expect(manifestGaps(manifest, [...SPEC_PROPERTY_IDS])).toEqual([]);
    // missing mapped property
    const noMap = { ...manifest, propertyTests: {} };
    expect(manifestGaps(noMap, [...SPEC_PROPERTY_IDS]).some((g) => g.includes("p-choose-outcome"))).toBe(true);
    // missing edge scenario declaration
    const noEdge = manifest.scenarios.filter((s) => s.kind !== "edge");
    expect(
      manifestGaps({ ...manifest, scenarios: noEdge }, [...SPEC_PROPERTY_IDS]).some(
        (g) => g === "edge scenario category invalid-context-contract missing on target web",
      ),
    ).toBe(true);
    // unversioned replay fixture
    const stale = manifest.replayFixtures.map((f) => ({ ...f, schemaVersion: "" }));
    expect(
      manifestGaps({ ...manifest, replayFixtures: stale }, [...SPEC_PROPERTY_IDS]).some(
        (g) => g.includes("replay-web") && g.includes("schemaVersion"),
      ),
    ).toBe(true);
    // no declared adapter target
    expect(manifestGaps({ ...manifest, adapterTargets: [] }, [...SPEC_PROPERTY_IDS])).toContain(
      "no declared adapter targets",
    );
  });

  it("TypeScript CI test: one failed/skipped mandatory scenario or target prevents the suite from entering passed", () => {
    const manifest = completeManifest();
    const start = () => {
      const gate = createConformanceGate({
        revisionId: "rev-1",
        manifest,
        specPropertyIds: [...SPEC_PROPERTY_IDS],
      });
      gate.fire("map_property_tests");
      gate.fire("begin_test_run");
      return gate;
    };
    // all mandatory scenarios pass → the suite enters passed
    const passing = start();
    passing.recordOutcomes(allPassOutcomes(manifest));
    expect(passing.fire("accept_test_run").ok).toBe(true);
    // one failed mandatory scenario → refused, naming the scenario
    const failing = start();
    failing.recordOutcomes({ "sec-hostile-payload-web": "fail" });
    const r = failing.fire("accept_test_run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard test_suite_passed does not hold: mandatory scenario sec-hostile-payload-web on target web is fail",
    );
    // one skipped mandatory scenario → reported incomplete, not passed
    const skipping = start();
    skipping.recordOutcomes({ "edge-host-loss-tui-neg": "skipped" });
    const r2 = skipping.fire("accept_test_run");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "guard test_suite_passed does not hold: mandatory scenario edge-host-loss-tui-neg on target tui is skipped",
    );
  });
});
