// Purpose: property tests for the process-model layer — failure edges, failure provenance, compound activities
// Responsibilities: the effect/graph properties as vitest tests; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/process-model/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createProcessMachine, PROCESS_TRANSITIONS } from "../../src/process-model/machine";
import {
  compoundPatternValid,
  failureRecoveryEdgesExplicit,
} from "../../src/process-model/invariants";
import { PROCESS_STATES } from "../../src/process-model/types";
import type { CompoundActivity, InteractionPattern } from "../../src/process-model/types";
import { failibleDefinition, toRunning, validDefinition } from "./fixtures";
import { SCHEMA_VERSION } from "../../src/process-model/types";

describe("process-model effect properties", () => {
  it("Graph test: effectful nodes expose typed failure/recovery edges", () => {
    const recovery = [
      { onFailure: "payments.charge", reconciliation: "compensate:payments.refund", edgeType: "compensate" },
    ] as const;
    const effectfulOk = validDefinition({
      processId: "proc-charge",
      externalEffects: ["payments.charge"],
      failureEdges: { containment: "step", recovery },
    });
    const effectfulBare = validDefinition({
      processId: "proc-bare",
      externalEffects: ["payments.charge"],
      failureEdges: null,
    });
    const effectfulGeneric = validDefinition({
      processId: "proc-generic",
      externalEffects: ["mail.send"],
      failureEdges: { containment: "step", recovery: [] },
    });
    const effectfulUntyped = validDefinition({
      processId: "proc-untyped",
      externalEffects: ["mail.send"],
      failureEdges: {
        containment: "step",
        recovery: [{ onFailure: "mail.send", reconciliation: "?!", edgeType: "teleport" as never }],
      },
    });
    const pure = validDefinition({ processId: "proc-pure" });
    const nodes = [effectfulOk, effectfulBare, effectfulGeneric, effectfulUntyped, pure];
    // graph-level: every effectful node exposes typed failure/recovery edges; pure nodes need none
    for (const node of nodes) {
      const check = failureRecoveryEdgesExplicit(node);
      if (node.externalEffects.length === 0) {
        expect(check.ok).toBe(true);
      } else {
        expect(check.ok).toBe(node.processId === "proc-charge");
      }
    }
    // each violation is named precisely
    expect(failureRecoveryEdgesExplicit(effectfulBare).reason).toBe(
      "effectful process 'proc-bare' declares external effects but no failure containment and recovery edges",
    );
    expect(failureRecoveryEdgesExplicit(effectfulGeneric).reason).toBe(
      "effectful process 'proc-generic' declares a generic failed terminal with no recovery/reconciliation edges",
    );
    expect(failureRecoveryEdgesExplicit(effectfulUntyped).reason).toBe(
      "recovery edge for 'mail.send' is not a typed failure/recovery edge",
    );
    // machine boundary: an effectful process without recovery edges cannot slide into a generic failed terminal
    const m = toRunning(failibleDefinition({ processId: "proc-bare", externalEffects: ["payments.charge"] }));
    const r = m.fire("fail_process", "gateway timeout");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "fail_process guard failure_recovery_edges_explicit does not hold: effectful process 'proc-bare' declares external effects but no failure containment and recovery edges",
    );
    expect(m.state).toBe("running");
  });

  it("planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states", () => {
    const patterns: Record<CompoundActivity, readonly string[]> = {
      planning: ["decompose_intent", "propose_steps", "confirm_with_user"],
      diagnosis: ["gather_symptoms", "form_hypothesis", "test_hypothesis"],
      review: ["inspect_artifact", "annotate_findings", "decide_verdict"],
      coordination: ["assign_roles", "track_commitments", "resolve_conflicts"],
      monitoring: ["observe_signal", "compare_threshold", "raise_alert"],
      clarification: ["ask_question", "capture_answer", "update_context"],
    };
    for (const [activity, primitives] of Object.entries(patterns)) {
      const pattern: InteractionPattern = { activity: activity as CompoundActivity, primitives };
      expect(compoundPatternValid(pattern).ok).toBe(true);
      // composed of contribution primitives — several, never one atomic state
      expect(pattern.primitives.length).toBeGreaterThan(1);
      // the activity is not coerced into an atomic process state
      expect(PROCESS_STATES).not.toContain(activity);
      expect(PROCESS_TRANSITIONS.find((t) => t.id === activity)).toBeUndefined();
    }
    // edge case: an unknown activity is not a compound human activity
    expect(compoundPatternValid({ activity: "summarizing" as CompoundActivity, primitives: ["a"] }).reason).toBe(
      "activity 'summarizing' is not a compound human activity",
    );
    // edge case: an empty primitive composition is not a pattern
    expect(compoundPatternValid({ activity: "planning", primitives: [] }).reason).toBe(
      "an interaction pattern composes at least one contribution primitive",
    );
    // a definition carrying a pattern is a normal process definition — the pattern is metadata
    const def = validDefinition({ interactionPattern: { activity: "review", primitives: patterns.review } });
    const m = createProcessMachine(def);
    expect(m.state).toBe("draft");
    expect(m.definition.interactionPattern?.primitives).toEqual(patterns.review);
    expect(m.fire("validate_process").ok).toBe(true);
  });

  it("failure provenance retained ∧ recovery/reconciliation edges surfaced", () => {
    const recovery = [
      { onFailure: "payments.charge", reconciliation: "compensate:payments.refund", edgeType: "compensate" as const },
    ];
    const def = failibleDefinition({
      processId: "proc-charge",
      externalEffects: ["payments.charge"],
      failureEdges: { containment: "step", recovery },
    });
    const m = toRunning(def);
    expect(m.fire("fail_process", "payment gateway timeout").ok).toBe(true);
    expect(m.state).toBe("failed");
    // failure provenance retained
    const record = m.failureRecord;
    expect(record).not.toBeNull();
    expect(record?.detail).toBe("payment gateway timeout");
    expect(record?.provenance).toEqual({
      processId: "proc-charge",
      schemaVersion: SCHEMA_VERSION,
      modelKind: "finite_state_workflow",
      fromState: "running",
      transition: "fail_process",
    });
    // recovery/reconciliation edges surfaced per failure_recovery_edges_explicit
    expect(record?.recoveryEdges).toEqual(recovery);
    expect(record?.recoveryEdges[0]?.edgeType).toBe("compensate");
    // the record persists on the machine — retained, not ephemeral
    expect(m.failureRecord).toBe(record);
    expect(m.history).toEqual([
      { id: "validate_process", from: "draft", to: "validated" },
      { id: "start_process", from: "validated", to: "running" },
      { id: "fail_process", from: "running", to: "failed" },
    ]);
  });
});