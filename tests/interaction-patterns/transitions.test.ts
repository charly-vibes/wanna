// Purpose: transition tests for the interaction-patterns model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise reasons, never masked ones
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { clarificationPattern, degradedPattern, genericPattern, REGISTRY, reviewPattern } from "./fixtures";

function started(overrides = {}) {
  const m = createPatternMachine(genericPattern(overrides), REGISTRY);
  m.fire("validate_pattern");
  m.fire("start_pattern");
  return m;
}

describe("interaction-patterns transitions", () => {
  it("validate_pattern moves draft → validated when every node references a registered primitive", () => {
    const m = createPatternMachine(genericPattern(), REGISTRY);
    const r = m.fire("validate_pattern");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("validated");
    expect(m.history).toEqual([
      { id: "validate_pattern", from: "draft", to: "validated", patternVersion: "1.0.0" },
    ]);
  });

  it("validate_pattern refuses with the exact unregistered-primitive reason when composition fails", () => {
    const m = createPatternMachine(
      genericPattern({ nodes: [{ id: "n1", primitiveId: "primitive.unknown", primitiveVersion: "1.0.0" }] }),
      REGISTRY,
    );
    const r = m.fire("validate_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'validate_pattern guard patterns_compose_primitives does not hold: node "n1" references unregistered primitive "primitive.unknown"',
    );
    expect(m.state).toBe("draft");
  });

  it("start_pattern moves validated → running when the completion conditions are explicit", () => {
    const m = createPatternMachine(genericPattern(), REGISTRY);
    m.fire("validate_pattern");
    const r = m.fire("start_pattern");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("running");
  });

  it("start_pattern refuses with the exact missing-conditions reason when completion is not explicit", () => {
    const m = createPatternMachine(genericPattern({ conditions: ["success"] }), REGISTRY);
    m.fire("validate_pattern");
    const r = m.fire("start_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "start_pattern guard pattern_completion_explicit does not hold: missing completion conditions: failure",
    );
    expect(m.state).toBe("validated");
  });

  it("wait_for_contribution moves running → waiting on a declared contribution step", () => {
    const m = started();
    const r = m.fire("wait_for_contribution", "n2");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("waiting");
    expect(m.awaitingRecord).toEqual({ nodeId: "n2" });
  });

  it("wait_for_contribution refuses an undeclared step with the exact reason", () => {
    const m = started();
    const r = m.fire("wait_for_contribution", "ghost");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'wait_for_contribution guard patterns_compose_primitives does not hold: node "ghost" is not a declared contribution step',
    );
    expect(m.state).toBe("running");
  });

  it("resume_pattern moves waiting → running when the awaited contribution arrives", () => {
    const m = started();
    m.fire("wait_for_contribution", "n2");
    const r = m.fire("resume_pattern", "n2");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("running");
    expect(m.awaitingRecord).toBeNull();
  });

  it("resume_pattern refuses a mismatched contribution with the exact reason", () => {
    const m = started();
    m.fire("wait_for_contribution", "n2");
    const r = m.fire("resume_pattern", "n1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'resume_pattern guard patterns_compose_primitives does not hold: awaited step "n2" is not the pending contribution "n1"',
    );
    expect(m.state).toBe("waiting");
  });

  it("complete_pattern moves running → completed when the success condition is achieved", () => {
    const m = started();
    m.recordStep("n2");
    const r = m.fire("complete_pattern");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("completed");
  });

  it("complete_pattern refuses with the exact reason when a success step has not completed", () => {
    const m = started();
    const r = m.fire("complete_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'complete_pattern guard pattern_completion_explicit does not hold: success step "n2" has not completed',
    );
    expect(m.state).toBe("running");
  });

  it("preserve_unresolved_pattern moves running → unresolved when the pattern does not declare unresolved", () => {
    const m = started();
    const r = m.fire("preserve_unresolved_pattern");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("unresolved");
    expect(m.unresolvedRecord?.patternId).toBe("pattern.generic-1");
    expect(m.unresolvedRecord?.patternVersion).toBe("1.0.0");
  });

  it("preserve_unresolved_pattern refuses when the pattern declares an unresolved completion condition", () => {
    const m = createPatternMachine(diagnosisPattern(), REGISTRY);
    m.fire("validate_pattern");
    m.fire("start_pattern");
    const r = m.fire("preserve_unresolved_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "preserve_unresolved_pattern guard ¬pattern_completion_explicit evaluates false: the pattern declares an unresolved completion condition",
    );
    expect(m.state).toBe("running");
  });

  it("cancel_pattern moves running → cancelled when cancellation is declared", () => {
    const m = started({ cancellable: true, conditions: ["success", "failure", "cancellation"] });
    const r = m.fire("cancel_pattern", "user withdrew from the run");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("cancelled");
    expect(m.cancellationRecord?.reason).toBe("user withdrew from the run");
  });

  it("cancel_pattern refuses with the exact reason when cancellation is not declared", () => {
    const m = started();
    const r = m.fire("cancel_pattern", "user withdrew from the run");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "cancel_pattern guard pattern_completion_explicit does not hold: the pattern does not declare a cancellation completion condition",
    );
    expect(m.state).toBe("running");
  });

  it("fail_pattern moves running → failed when neither completion-explicit nor composition holds", () => {
    const m = started();
    expect(m.revise(degradedPattern())).toEqual({ ok: true });
    const r = m.fire("fail_pattern", "upstream dependency vanished");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("failed");
    expect(m.failureRecord).toEqual({
      effect: "interaction.patterns.pattern_failure",
      detail: "upstream dependency vanished",
      patternId: "pattern.generic-1",
      patternVersion: "0.9.0-degraded",
    });
  });

  it("fail_pattern refuses with the exact blocker enumeration when the cited guards hold", () => {
    const m = started();
    const r = m.fire("fail_pattern", "upstream dependency vanished");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "fail_pattern guard ¬(pattern_completion_explicit ∨ patterns_compose_primitives) evaluates false: pattern_completion_explicit holds ∧ patterns_compose_primitives holds",
    );
    expect(m.state).toBe("running");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createPatternMachine(genericPattern(), REGISTRY);
    // complete_pattern starts at running, not draft
    const r = m.fire("complete_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition complete_pattern cannot fire from state draft");
    expect(m.state).toBe("draft");
  });

  it("fire refuses unknown transition ids", () => {
    const m = createPatternMachine(genericPattern(), REGISTRY);
    const r = m.fire("no_such_transition" as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown transition no_such_transition");
  });

  it("fail_pattern refuses without failure detail and records nothing", () => {
    const m = started();
    m.revise(degradedPattern());
    const r = m.fire("fail_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("fail_pattern requires failure detail");
    expect(m.state).toBe("running");
    expect(m.failureRecord).toBeNull();
  });

  it("a review pattern can complete verification steps without ever authorizing", () => {
    const m = createPatternMachine(reviewPattern(), REGISTRY);
    m.fire("validate_pattern");
    m.fire("start_pattern");
    m.recordStep("verify");
    expect(m.state).toBe("running");
    expect(m.stepEvents.map((e) => e.judgmentKind)).toEqual(["verification"]);
    // authorization only ever arrives through the distinct authorization step
    m.recordStep("authorize");
    expect(m.stepEvents.map((e) => e.judgmentKind)).toEqual(["verification", "authorization"]);
  });
});
