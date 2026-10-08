// Purpose: transition tests for the evaluation-telemetry model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons
import { describe, it, expect } from "vitest";
import {
  createEvaluationPipeline,
  EVALUATION_TRANSITIONS,
} from "../../src/evaluation-telemetry/machine";
import {
  failureOf,
  WORKLOAD,
  allGatesPass,
  breach,
  validMetric,
  validRecord,
  validRecovery,
} from "./fixtures";

const METRICS_REASON =
  'guard metrics_have_definitions does not hold: metric "correction_rate" does not declare missing-data behavior';
const EVIDENCE_REASON = `guard promotion_requires_evidence does not hold: safety gate has not passed for workload "${WORKLOAD}"`;
const VERSIONED_REASON =
  "guard metrics_versioned does not hold: evaluation record does not identify the evaluator version";
const NO_POLICY_REASON =
  "guard regression_triggers_fallback does not hold: no explicit recovery policy is declared for the promoted implementation";
const NO_ROLLBACK_REASON =
  "guard regression_triggers_fallback does not hold: the recovery policy does not permit rollback";

describe("evaluation-telemetry transitions", () => {
  it("evaluate_candidate moves collecting → evaluated when the metrics_have_definitions guard holds", () => {
    const m = createEvaluationPipeline(validRecord());
    const r = m.fire("evaluate_candidate", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("evaluated");
    expect(m.transitionLog).toEqual([
      { id: "evaluate_candidate", from: "collecting", to: "evaluated" },
    ]);
  });

  it("evaluate_candidate refuses to fire when a metric omits a declared dimension", () => {
    const m = createEvaluationPipeline(
      validRecord({ metrics: [validMetric({ missingDataBehavior: "" })] }),
    );
    const r = m.fire("evaluate_candidate", undefined);
    expect(r.ok).toBe(false);
    expect(failureOf(r)).toBe(METRICS_REASON);
    expect(m.state).toBe("collecting");
  });

  it("mark_eligible moves evaluated → eligible when the promotion_requires_evidence guard holds", () => {
    const m = createEvaluationPipeline(validRecord());
    m.fire("evaluate_candidate", undefined);
    const r = m.fire("mark_eligible", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("eligible");
  });

  it("mark_eligible refuses to fire when a required gate has not passed", () => {
    const m = createEvaluationPipeline(
      validRecord({ gateResults: allGatesPass().map((g) => (g.kind === "safety" ? { ...g, passed: false } : g)) }),
    );
    m.fire("evaluate_candidate", undefined);
    const r = m.fire("mark_eligible", undefined);
    expect(r.ok).toBe(false);
    expect(failureOf(r)).toBe(EVIDENCE_REASON);
    expect(m.state).toBe("evaluated");
  });

  it("promote_candidate moves eligible → promoted when the metrics_versioned guard holds", () => {
    const m = createEvaluationPipeline(validRecord());
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    const r = m.fire("promote_candidate", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("promoted");
  });

  it("promote_candidate refuses to fire when the evaluation record omits an identifier", () => {
    const m = createEvaluationPipeline(
      validRecord({ evaluatorVersion: "" }),
    );
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    const r = m.fire("promote_candidate", undefined);
    expect(r.ok).toBe(false);
    expect(failureOf(r)).toBe(VERSIONED_REASON);
    expect(m.state).toBe("eligible");
  });

  it("detect_degradation moves promoted → degraded when the regression_triggers_fallback guard holds", () => {
    const m = createEvaluationPipeline(validRecord());
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    m.fire("promote_candidate", undefined);
    const r = m.fire("detect_degradation", breach("quality"));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("degraded");
  });

  it("detect_degradation refuses to fire when no explicit recovery policy is declared", () => {
    const m = createEvaluationPipeline(
      validRecord({ recovery: validRecovery({ declared: false }) }),
    );
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    m.fire("promote_candidate", undefined);
    const r = m.fire("detect_degradation", breach("safety"));
    expect(r.ok).toBe(false);
    expect(failureOf(r)).toBe(NO_POLICY_REASON);
    expect(m.state).toBe("promoted");
  });

  it("rollback_candidate moves degraded → rolled_back when the recovery policy permits rollback", () => {
    const m = createEvaluationPipeline(validRecord());
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    m.fire("promote_candidate", undefined);
    m.fire("detect_degradation", breach("safety"));
    const r = m.fire("rollback_candidate", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rolled_back");
  });

  it("rollback_candidate refuses to fire when the recovery policy does not permit rollback", () => {
    const m = createEvaluationPipeline(
      validRecord({ recovery: validRecovery({ allowsRollback: false }) }),
    );
    m.fire("evaluate_candidate", undefined);
    m.fire("mark_eligible", undefined);
    m.fire("promote_candidate", undefined);
    m.fire("detect_degradation", breach("safety"));
    const r = m.fire("rollback_candidate", undefined);
    expect(r.ok).toBe(false);
    expect(failureOf(r)).toBe(NO_ROLLBACK_REASON);
    expect(m.state).toBe("degraded");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createEvaluationPipeline(validRecord());
    // from the initial state, every transition except evaluate_candidate is unreachable
    expect(EVALUATION_TRANSITIONS.length).toBe(5);
    for (const row of EVALUATION_TRANSITIONS) {
      if (row.id === "evaluate_candidate") continue;
      const r = m.fire(row.id, row.id === "detect_degradation" ? breach("quality") : undefined);
      expect(r.ok).toBe(false);
      expect(failureOf(r)).toContain(row.id);
      expect(m.state).toBe("collecting");
    }
  });
});