// Purpose: transition tests for the conformance suite gate
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; loose reason regexes let real bypasses through
import { describe, it, expect } from "vitest";
import { createConformanceGate } from "../../src/conformance-tests/machine";
import {
  ADAPTER_TARGETS,
  SPEC_PROPERTY_IDS,
  allPassOutcomes,
  completeManifest,
  fixRecordFor,
} from "./fixtures";

describe("conformance-tests transitions", () => {
  it("map_property_tests moves unmapped → mapped when every property maps to an existing named test", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    const r = gate.fire("map_property_tests");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("mapped");
  });

  it("map_property_tests refuses a revision that drops a declared property, naming the violated row", () => {
    const manifest = completeManifest();
    // revision drops p-confirm-gate's mapping — the gate must name the row
    const gate = createConformanceGate({
      revisionId: "rev-2",
      manifest: {
        ...manifest,
        propertyTests: {
          "p-choose-outcome": ["choose-outcome.test.ts"],
          "p-annotate-target": ["annotate-target.test.ts"],
        },
      },
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    const r = gate.fire("map_property_tests");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard every_property_mapped_to_test does not hold: unmapped properties p-confirm-gate",
    );
    expect(gate.state).toBe("unmapped");
  });

  it("begin_test_run moves mapped → running when the suite manifest is complete", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    const r = gate.fire("begin_test_run");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("running");
  });

  it("begin_test_run refuses when the manifest is incomplete, naming the missing row kind", () => {
    const manifest = completeManifest();
    // scenarios for the tui target are not declared — every required category is missing there
    const thin = {
      ...manifest,
      scenarios: manifest.scenarios.filter((s) => s.adapter === "web"),
    };
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: thin,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    const r = gate.fire("begin_test_run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard suite_manifest_complete does not hold: edge scenario category invalid-context-contract missing on target tui; edge scenario category zero-eligible-candidates missing on target tui; edge scenario category deterministic-ties missing on target tui; edge scenario category stale-events missing on target tui; edge scenario category duplicate-events missing on target tui; edge scenario category concurrent-submissions missing on target tui; edge scenario category cancellation missing on target tui; edge scenario category version-skew missing on target tui; edge scenario category unsupported-capabilities missing on target tui; edge scenario category host-loss missing on target tui; edge scenario category persistence-faults missing on target tui; security scenario category hostile-payload missing on target tui; security scenario category forged-event missing on target tui; security scenario category authorization-bypass missing on target tui; security scenario category resource-limit missing on target tui; security scenario category diagnostic-leak missing on target tui",
    );
    expect(gate.state).toBe("mapped");
  });

  it("accept_test_run moves running → passed when every mandatory scenario on every target passes", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes(allPassOutcomes(manifest));
    const r = gate.fire("accept_test_run");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("passed");
    expect(gate.lastPassedRevision).toBe("rev-1");
  });

  it("accept_test_run refuses when one mandatory scenario failed, naming scenario and target", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    const r = gate.recordOutcomes({ "sec-forged-event-tui": "fail" });
    expect(r.ok).toBe(true);
    const accept = gate.fire("accept_test_run");
    expect(accept.ok).toBe(false);
    expect(accept.reason).toBe(
      "guard test_suite_passed does not hold: mandatory scenario sec-forged-event-tui on target tui is fail",
    );
    expect(gate.state).toBe("running");
  });

  it("accept_test_run refuses when a mandatory scenario was skipped — skipped is incomplete, not passed", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes({ "edge-cancellation-web-pass": "skipped" });
    const r = gate.fire("accept_test_run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard test_suite_passed does not hold: mandatory scenario edge-cancellation-web-pass on target web is skipped",
    );
    expect(gate.state).toBe("running");
  });

  it("reject_test_run moves running → failed when test_suite_passed does not hold", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    const r = gate.fire("reject_test_run");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("failed");
    // unrecorded mandatory scenarios are findings naming the violated rows
    expect(gate.findings.length).toBeGreaterThan(0);
    expect(gate.findings[0]).toBe(
      "mandatory scenario edge-invalid-context-contract-web-pass on target web is unrecorded",
    );
  });

  it("reject_test_run refuses when the suite actually passed", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes(allPassOutcomes(manifest));
    const r = gate.fire("reject_test_run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reject_test_run requires test_suite_passed to not hold");
    expect(gate.state).toBe("running");
  });

  it("rerun_after_correction moves failed → mapped when the fix and regression case are committed", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
      fixRecords: [fixRecordFor("edge-cancellation-web-pass")],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes({ "edge-cancellation-web-pass": "fail" });
    gate.fire("reject_test_run");
    expect(gate.state).toBe("failed");
    const r = gate.fire("rerun_after_correction");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("mapped");
    expect(gate.findings).toEqual([]);
  });

  it("rerun_after_correction refuses without a committed fix and retained regression case, naming the failed scenario", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
      fixRecords: [
        // fix exists but is not committed, and no regression scenario retained
        { revisionId: "rev-1", fixedScenarioId: "edge-cancellation-web-pass", regressionScenarioId: "", committed: false },
      ],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes({ "edge-cancellation-web-pass": "fail" });
    gate.fire("reject_test_run");
    const r = gate.fire("rerun_after_correction");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard fix_committed does not hold: scenario edge-cancellation-web-pass has no committed fix and retained regression case",
    );
    expect(gate.state).toBe("failed");
  });

  it("prepare_next_release moves passed → unmapped when a new revision is submitted", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes(allPassOutcomes(manifest));
    gate.fire("accept_test_run");
    const r = gate.prepare("rev-2");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("unmapped");
    expect(gate.revisionId).toBe("rev-2");
    // the pass belongs to rev-1 only — rev-2 has no inherited status
    expect(gate.lastPassedRevision).toBe("rev-1");
  });

  it("prepare_next_release refuses when no new revision is submitted, naming the unchanged revision", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes(allPassOutcomes(manifest));
    gate.fire("accept_test_run");
    const r = gate.prepare("rev-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard new_release_candidate does not hold: no new revision submitted (revision rev-1 unchanged)",
    );
    expect(gate.state).toBe("passed");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    // accept_test_run starts at running, not unmapped
    const r = gate.fire("accept_test_run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition accept_test_run cannot fire from state unmapped");
    expect(gate.state).toBe("unmapped");
    // reject_test_run also starts at running
    const r2 = gate.fire("reject_test_run");
    expect(r2.reason).toBe("transition reject_test_run cannot fire from state unmapped");
  });

  it("outcomes can only be recorded while the suite is running", () => {
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    const r = gate.recordOutcomes({ "edge-cancellation-web-pass": "pass" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("outcomes can only be recorded while the suite is running (state unmapped)");
  });

  it("the conformance gate rejects a revision dropping a property with no partial deploy", () => {
    // gate-level: dropped property → map refused, state unmapped, revision not admitted
    const gate = createConformanceGate({
      revisionId: "rev-9",
      manifest: completeManifest(),
      specPropertyIds: [...SPEC_PROPERTY_IDS, "p-never-mapped"],
    });
    const r = gate.fire("map_property_tests");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("p-never-mapped");
    expect(gate.state).toBe("unmapped");
    expect(ADAPTER_TARGETS.length).toBe(2);
  });
});
