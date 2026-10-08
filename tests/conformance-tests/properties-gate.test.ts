// Purpose: property tests for release gates, usability distinctness, and empirical claims
// Responsibilities: corpus properties of conformance-tests as vitest tests; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/conformance-tests/*.toml to these tests via `vitest run -t '<description>'`
import { describe, it, expect } from "vitest";
import {
  acceptanceStatus,
  baselineGaps,
  blockedClaims,
  createConformanceGate,
  empiricalClaimVerdict,
  recordUsabilityStatus,
  usabilityAfterMachinePass,
} from "../../src/conformance-tests/index";
import type {
  EmpiricalClaim,
  FixRecord,
  GateResult,
  MeasurementSet,
  UsageClaim,
} from "../../src/conformance-tests/index";
import { SPEC_PROPERTY_IDS, allPassOutcomes, completeManifest, fixRecordFor } from "./fixtures";

describe("conformance-tests release-gate properties", () => {
  it("Release gate test: performance/usability claims require baseline and advisor-guided measurements over the same scenario set", () => {
    const claims: UsageClaim[] = [
      { kind: "performance", scenarioSet: "task-flow-a" },
      { kind: "usability", scenarioSet: "task-flow-a" },
    ];
    const measured: MeasurementSet[] = [
      { scenarioSet: "task-flow-a", baseline: true, advisorGuided: true },
    ];
    expect(baselineGaps(claims, measured)).toEqual([]);
    // baseline-only measurement does not support the claim
    const baselineOnly: MeasurementSet[] = [
      { scenarioSet: "task-flow-a", baseline: true, advisorGuided: false },
    ];
    expect(baselineGaps(claims, baselineOnly)).toEqual([
      "performance claim on scenario set task-flow-a requires baseline and advisor-guided measurements",
      "usability claim on scenario set task-flow-a requires baseline and advisor-guided measurements",
    ]);
    // a different scenario set does not support the claim
    const otherSet: MeasurementSet[] = [
      { scenarioSet: "task-flow-b", baseline: true, advisorGuided: true },
    ];
    expect(baselineGaps(claims, otherSet).length).toBe(2);
  });

  it("Release gate test: absent lint/model-check/test evidence prevents the corresponding quality claim", () => {
    const claims: readonly string[] = ["lint-clean", "model-checked", "verified", "portable", "secure"];
    // all gates pass → all claims allowed
    const passing: GateResult[] = [
      { gate: "lint-clean", result: "pass" },
      { gate: "model-checked", result: "pass" },
      { gate: "verified", result: "pass" },
      { gate: "portable", result: "pass" },
      { gate: "secure", result: "pass" },
    ];
    expect(blockedClaims(claims, passing)).toEqual([]);
    // test evidence absent → the verified claim is blocked, others survive
    const noTests: GateResult[] = passing.filter((g) => g.gate !== "verified");
    expect(blockedClaims(claims, noTests)).toEqual([
      "claim verified has no passing verified gate result",
    ]);
    // a failed gate blocks its claim even though a result exists
    const failedGate: GateResult[] = [
      ...noTests.filter((g) => g.gate !== "secure"),
      { gate: "secure", result: "fail" },
    ];
    expect(blockedClaims(claims, failedGate)).toEqual([
      "claim verified has no passing verified gate result",
      "claim secure has no passing secure gate result",
    ]);
  });

  it("TypeScript CI test: retry after failure requires a committed fix and retained regression case", () => {
    // exercised end-to-end on the machine: a failed run returns to mapped only after
    // the relevant fix and regression scenario are committed to the suite
    const manifest = completeManifest();
    const scenario = "edge-cancellation-web-pass";
    const start = (fixes: readonly FixRecord[]) => {
      const gate = createConformanceGate({
        revisionId: "rev-1",
        manifest,
        specPropertyIds: [...SPEC_PROPERTY_IDS],
        fixRecords: fixes,
      });
      gate.fire("map_property_tests");
      gate.fire("begin_test_run");
      gate.recordOutcomes({ [scenario]: "fail" });
      gate.fire("reject_test_run");
      return gate;
    };
    // committed fix + retained regression scenario → the run returns to mapped
    const fixed = start([fixRecordFor(scenario)]);
    expect(fixed.fire("rerun_after_correction").ok).toBe(true);
    expect(fixed.state).toBe("mapped");
    // uncommitted fix → refused, naming the failed scenario
    const uncommitted = start([fixRecordFor(scenario, { committed: false })]);
    const r = uncommitted.fire("rerun_after_correction");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      `guard fix_committed does not hold: scenario ${scenario} has no committed fix and retained regression case`,
    );
    // committed fix without a retained regression case → refused
    const noRegression = start([fixRecordFor(scenario, { regressionScenarioId: "" })]);
    expect(noRegression.fire("rerun_after_correction").ok).toBe(false);
  });

  it("Release gate test: a changed code/spec/policy/catalog revision cannot inherit the prior revision's pass status", () => {
    const manifest = completeManifest();
    const gate = createConformanceGate({
      revisionId: "rev-1",
      manifest,
      specPropertyIds: [...SPEC_PROPERTY_IDS],
    });
    gate.fire("map_property_tests");
    gate.fire("begin_test_run");
    gate.recordOutcomes(allPassOutcomes(manifest));
    expect(gate.fire("accept_test_run").ok).toBe(true);
    // pass status is bound to rev-1
    expect(gate.passStatus("rev-1")).toBe("passed");
    // a changed revision reads as not passed — it must run its own suite
    expect(gate.passStatus("rev-2")).toBe("stale");
    expect(gate.passStatus("rev-2")).not.toBe("passed");
    // and the gate only re-enters the cycle through a new revision submission
    expect(gate.prepare("rev-2").ok).toBe(true);
    expect(gate.state).toBe("unmapped");
    expect(gate.revisionId).toBe("rev-2");
  });

  it("Documentation test: automated pass status cannot set empirical usability status to passed", () => {
    // machine conformance leaves empirical usability exactly where it was
    expect(usabilityAfterMachinePass("unverified")).toBe("unverified");
    expect(usabilityAfterMachinePass("passed")).toBe("passed");
    // only representative user evidence can set usability to passed
    expect(recordUsabilityStatus("unverified", null)).toBe("unverified");
    expect(
      recordUsabilityStatus("unverified", { studyKind: "heuristic-review", participants: 9 }),
    ).toBe("unverified");
    expect(
      recordUsabilityStatus("unverified", { studyKind: "representative-user-study", participants: 0 }),
    ).toBe("unverified");
    expect(
      recordUsabilityStatus("unverified", { studyKind: "representative-user-study", participants: 12 }),
    ).toBe("passed");
  });

  it("Provenance test: absent evidence keeps acceptance status planned/unverified", () => {
    // not implemented → planned regardless of evidence
    expect(acceptanceStatus({ implemented: false, evidenceRecorded: false })).toBe("planned");
    expect(acceptanceStatus({ implemented: false, evidenceRecorded: true })).toBe("planned");
    // implemented but no evidence → unverified
    expect(acceptanceStatus({ implemented: true, evidenceRecorded: false })).toBe("unverified");
    // implemented with evidence → verified
    expect(acceptanceStatus({ implemented: true, evidenceRecorded: true })).toBe("verified");
  });

  it("learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named", () => {
    // a human outcome without evidence and without a named proxy stays empirical
    const bare: EmpiricalClaim = { outcome: "learnability" };
    const bareVerdict = empiricalClaimVerdict(bare);
    expect(bareVerdict.machineVerifiable).toBe(false);
    expect(bareVerdict.reason).toContain("learnability");
    expect(bareVerdict.reason).toContain("representative user evidence");
    // representative user evidence makes the outcome checkable
    const studied: EmpiricalClaim = { outcome: "trust-calibration", evidenceKind: "representative-user-study" };
    expect(empiricalClaimVerdict(studied).machineVerifiable).toBe(true);
    // a narrower machine-verifiable proxy explicitly named makes it checkable — named, not assumed
    const proxied: EmpiricalClaim = {
      outcome: "perceived-control",
      machineProxy: "undo-intent-correlation-over-recorded-sessions",
    };
    const proxyVerdict = empiricalClaimVerdict(proxied);
    expect(proxyVerdict.machineVerifiable).toBe(true);
    expect(proxyVerdict.reason).toContain("undo-intent-correlation-over-recorded-sessions");
    // proxy claimed but empty is not a named proxy
    expect(empiricalClaimVerdict({ outcome: "comprehension", machineProxy: " " }).machineVerifiable).toBe(false);
    // the proxy verdict must NOT silently claim representative user evidence
    expect(empiricalClaimVerdict(proxied).reason).not.toContain("representative user evidence");
  });
});
