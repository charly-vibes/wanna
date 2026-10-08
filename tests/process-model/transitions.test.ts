// Purpose: transition tests for the process-model machine
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with precise refusal reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guard refusals name the violated constraint exactly (no masked violations)
import { describe, it, expect } from "vitest";
import { createProcessMachine } from "../../src/process-model/machine";
import { failibleDefinition, refusalOutcomes, toRunning, validDefinition } from "./fixtures";
import type { TransitionId } from "../../src/process-model/types";

describe("process-model transitions", () => {
  it("validate_process moves draft → validated when the completion-criteria guard holds", () => {
    const m = createProcessMachine(validDefinition());
    expect(m.state).toBe("draft");
    const r = m.fire("validate_process");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
    expect(m.history).toEqual([{ id: "validate_process", from: "draft", to: "validated" }]);
    // precise refusal: a definition declaring no completion criteria cannot validate
    const bad = createProcessMachine(validDefinition({ completionConditions: [] }));
    const rb = bad.fire("validate_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "validate_process guard completion_criteria_explicit does not hold: process declares no completion conditions",
    );
    expect(bad.state).toBe("draft");
  });

  it("start_process moves validated → running when the transitions-guarded guard holds", () => {
    const m = createProcessMachine(validDefinition());
    m.fire("validate_process");
    const r = m.fire("start_process");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("running");
    expect(m.history).toEqual([
      { id: "validate_process", from: "draft", to: "validated" },
      { id: "start_process", from: "validated", to: "running" },
    ]);
    // precise refusal: a transition declaring no refusal outcome blocks the start
    const stripped = refusalOutcomes();
    delete stripped.cancel_process;
    const bad = createProcessMachine(validDefinition({ transitionRefusals: stripped }));
    bad.fire("validate_process");
    const rb = bad.fire("start_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "start_process guard transitions_guarded does not hold: transition cancel_process declares no refusal outcome for when its guard is false or evaluation is unavailable",
    );
    expect(bad.state).toBe("validated");
  });

  it("suspend_process moves running → waiting when the waits-correlated guard holds", () => {
    const m = toRunning(validDefinition());
    // precise refusal: suspension without a correlated resume event
    const rb = m.fire("suspend_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "suspend_process guard waits_correlated does not hold: no correlated resume event supplied",
    );
    expect(m.state).toBe("running");
    const r = m.fire("suspend_process", "reviewer_response");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("waiting");
    // suspended work records the event that can resume it
    expect(m.waitRecord?.resumeEvent).toBe("reviewer_response");
  });

  it("resume_correlated_wait moves waiting → running when the resume event correlates with the suspended wait", () => {
    const m = toRunning(validDefinition());
    m.fire("suspend_process", "reviewer_response");
    // precise refusal: an unrelated event cannot resume the wait
    const rb = m.fire("resume_correlated_wait", "timer_tick");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "resume_correlated_wait guard waits_correlated does not hold: event 'timer_tick' does not correlate with the suspended wait event 'reviewer_response'",
    );
    expect(m.state).toBe("waiting");
    const r = m.fire("resume_correlated_wait", "reviewer_response");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("running");
    expect(m.waitRecord).toBeNull();
  });

  it("complete_process moves running → completed when every declared completion condition has been evaluated successfully", () => {
    const m = toRunning(validDefinition());
    // precise refusal: declared criteria not yet evaluated
    const rb = m.fire("complete_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "complete_process guard completion_criteria_explicit does not hold: completion condition 'reviewer_signoff' has not been evaluated successfully",
    );
    expect(m.state).toBe("running");
    m.evaluateCompletion("reviewer_signoff");
    m.evaluateCompletion("all_checks_green");
    const r = m.fire("complete_process");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("completed");
  });

  it("fail_process moves running → failed when none of the completion/wait/cancellation guards hold", () => {
    const m = toRunning(failibleDefinition());
    // precise refusal: failure detail is required provenance
    const rd = m.fire("fail_process");
    expect(rd.ok).toBe(false);
    expect(rd.reason).toBe("fail_process requires failure detail");
    const r = m.fire("fail_process", "upstream dependency vanished");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("failed");
    expect(m.failureRecord?.detail).toBe("upstream dependency vanished");
    // precise refusal: declared semantics hold, so the generic failed terminal is blocked
    const m2 = toRunning(validDefinition());
    const blocked = m2.fire("fail_process", "x");
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe(
      "fail_process guard ¬(completion_criteria_explicit ∨ waits_correlated ∨ cancellation_semantics_defined) evaluates false: waits_correlated holds ∧ cancellation_semantics_defined holds",
    );
    // evaluated completion criteria also block generic failure
    m2.evaluateCompletion("reviewer_signoff");
    m2.evaluateCompletion("all_checks_green");
    expect(m2.fire("fail_process", "x").reason).toBe(
      "fail_process guard ¬(completion_criteria_explicit ∨ waits_correlated ∨ cancellation_semantics_defined) evaluates false: completion_criteria_explicit holds ∧ waits_correlated holds ∧ cancellation_semantics_defined holds",
    );
    expect(m2.state).toBe("running");
  });

  it("cancel_process moves running → cancelled when the cancellation-semantics guard holds", () => {
    const m = toRunning(validDefinition());
    const r = m.fire("cancel_process");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("cancelled");
    // precise refusal: no declared cancellation semantics
    const bad = toRunning(failibleDefinition());
    const rb = bad.fire("cancel_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "cancel_process guard cancellation_semantics_defined does not hold: process declares no cancellation semantics",
    );
    expect(bad.state).toBe("running");
  });

  it("every transition refuses to fire from a state it does not originate from, with a defined outcome", () => {
    const m = createProcessMachine(validDefinition());
    // start_process originates at validated, not draft
    const r = m.fire("start_process");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition start_process requires state validated but process is draft");
    expect(m.state).toBe("draft");
    // unknown transition ids are also defined outcomes
    const u = m.fire("teleport_process" as unknown as TransitionId);
    expect(u.ok).toBe(false);
    expect(u.reason).toBe("unknown transition: teleport_process");
  });
});