// Purpose: property tests for the process-model layer — the seven declared invariants
// Responsibilities: each invariant conformance property as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/process-model/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createProcessMachine } from "../../src/process-model/machine";
import {
  completionCriteriaExplicit,
  conditionsAllEvaluated,
  dependenciesAcyclicOrDeclared,
  processKindExplicit,
  transitionsGuarded,
  cancellationSemanticsDefined,
  waitsCorrelated,
} from "../../src/process-model/invariants";
import { toRunning, validDefinition } from "./fixtures";

describe("process-model properties", () => {
  it("TypeScript conformance test: assert invariant process_kind_explicit at its trust boundary and under its stated edge cases.", () => {
    expect(processKindExplicit(validDefinition()).ok).toBe(true);
    expect(() => createProcessMachine(validDefinition())).not.toThrow();
    // edge case: no model kind declared
    expect(() => createProcessMachine(validDefinition({ modelKind: undefined }))).toThrow(
      /process declares no model kind/,
    );
    // edge case: unsupported model kind
    expect(() => createProcessMachine(validDefinition({ modelKind: "spreadsheet" }))).toThrow(
      /unsupported model kind: spreadsheet/,
    );
    // edge case: stale schema version
    const stale = validDefinition({ schemaVersion: "process-model-schema-1999" });
    expect(() => createProcessMachine(stale)).toThrow(/canonical schema version/);
    expect(processKindExplicit(stale).ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant transitions_guarded at its trust boundary and under its stated edge cases.", () => {
    expect(transitionsGuarded(validDefinition()).ok).toBe(true);
    // edge case: guard evaluation unavailable — a transition declares no refusal outcome
    const stripped = validDefinition().transitionRefusals;
    const missing = { ...stripped };
    delete missing.cancel_process;
    const def = validDefinition({ transitionRefusals: missing });
    const check = transitionsGuarded(def);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(
      "transition cancel_process declares no refusal outcome for when its guard is false or evaluation is unavailable",
    );
    // the machine boundary refuses to start such a process, naming the transition
    const m = createProcessMachine(def);
    m.fire("validate_process");
    const r = m.fire("start_process");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "start_process guard transitions_guarded does not hold: transition cancel_process declares no refusal outcome for when its guard is false or evaluation is unavailable",
    );
    expect(m.state).toBe("validated");
    // edge case: an empty refusal outcome is no outcome
    expect(
      transitionsGuarded(validDefinition({ transitionRefusals: { ...missing, cancel_process: "" } })).ok,
    ).toBe(false);
    // every refusal the machine emits is a defined outcome, never undefined behavior
    const wrongState = m.fire("complete_process");
    expect(wrongState.ok).toBe(false);
    expect(wrongState.reason).toBe("transition complete_process requires state running but process is validated");
    const unknown = m.fire("teleport_process" as never);
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toBe("unknown transition: teleport_process");
  });

  it("TypeScript conformance test: assert invariant dependencies_acyclic_or_declared at its trust boundary and under its stated edge cases.", () => {
    expect(dependenciesAcyclicOrDeclared(validDefinition()).ok).toBe(true);
    // edge case: cycle with no bounded loop construct
    const cycleEdges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ];
    const cycled = validDefinition({ dependencies: { nodes: ["a", "b", "c"], edges: cycleEdges } });
    const bad = dependenciesAcyclicOrDeclared(cycled);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe(
      "dependency graph contains cycle a -> b -> c -> a and no bounded loop construct declares termination and iteration limits",
    );
    // edge case: an explicit bounded loop construct declares the cycle
    const bounded = validDefinition({
      dependencies: { nodes: ["a", "b", "c"], edges: cycleEdges },
      boundedLoop: { terminationCondition: "iteration budget exhausted", maxIterations: 4 },
    });
    expect(dependenciesAcyclicOrDeclared(bounded).ok).toBe(true);
    // edge case: bounded loop without a termination condition
    expect(
      dependenciesAcyclicOrDeclared({
        ...bounded,
        boundedLoop: { terminationCondition: "", maxIterations: 4 },
      }).reason,
    ).toBe("bounded loop construct declares no termination condition (cycle a -> b -> c -> a)");
    // edge case: bounded loop without a positive iteration limit
    expect(
      dependenciesAcyclicOrDeclared({
        ...bounded,
        boundedLoop: { terminationCondition: "x", maxIterations: 0 },
      }).reason,
    ).toBe("bounded loop construct declares no positive iteration limit (cycle a -> b -> c -> a)");
  });

  it("TypeScript conformance test: assert invariant completion_criteria_explicit at its trust boundary and under its stated edge cases.", () => {
    expect(completionCriteriaExplicit(validDefinition()).ok).toBe(true);
    // edge case: no declared completion conditions
    expect(completionCriteriaExplicit(validDefinition({ completionConditions: [] })).reason).toBe(
      "process declares no completion conditions",
    );
    // edge case: an empty condition string
    expect(
      completionCriteriaExplicit(validDefinition({ completionConditions: ["signoff", ""] })).reason,
    ).toBe("completion condition at index 1 is empty");
    // machine boundary: validation requires declared completion criteria
    const m0 = createProcessMachine(validDefinition({ completionConditions: [] }));
    const rv = m0.fire("validate_process");
    expect(rv.ok).toBe(false);
    expect(rv.reason).toBe(
      "validate_process guard completion_criteria_explicit does not hold: process declares no completion conditions",
    );
    // completion requires every declared condition evaluated successfully
    const m = toRunning(validDefinition());
    expect(m.fire("complete_process").reason).toBe(
      "complete_process guard completion_criteria_explicit does not hold: completion condition 'reviewer_signoff' has not been evaluated successfully",
    );
    m.evaluateCompletion("reviewer_signoff");
    expect(m.fire("complete_process").reason).toBe(
      "complete_process guard completion_criteria_explicit does not hold: completion condition 'all_checks_green' has not been evaluated successfully",
    );
    // an undeclared condition being evaluated does not unblock completion
    m.evaluateCompletion("undeclared_condition");
    expect(m.fire("complete_process").ok).toBe(false);
    m.evaluateCompletion("all_checks_green");
    expect(m.fire("complete_process").ok).toBe(true);
    expect(m.state).toBe("completed");
    expect(conditionsAllEvaluated(validDefinition(), ["reviewer_signoff", "all_checks_green"]).ok).toBe(true);
  });

  it("TypeScript conformance test: assert invariant waits_correlated at its trust boundary and under its stated edge cases.", () => {
    expect(waitsCorrelated(validDefinition()).ok).toBe(true);
    // edge case: no correlated resume events declared
    expect(waitsCorrelated(validDefinition({ resumeEvents: [] })).reason).toBe(
      "process declares no correlated resume events",
    );
    // machine boundary: suspension without a correlated event is refused
    const m = toRunning(validDefinition());
    const rs = m.fire("suspend_process");
    expect(rs.ok).toBe(false);
    expect(rs.reason).toBe(
      "suspend_process guard waits_correlated does not hold: no correlated resume event supplied",
    );
    expect(m.state).toBe("running");
    // suspension records the correlated event
    expect(m.fire("suspend_process", "reviewer_response").ok).toBe(true);
    expect(m.state).toBe("waiting");
    expect(m.waitRecord?.resumeEvent).toBe("reviewer_response");
    // an unrelated event cannot resume the wait
    const rr = m.fire("resume_correlated_wait", "timer_tick");
    expect(rr.ok).toBe(false);
    expect(rr.reason).toBe(
      "resume_correlated_wait guard waits_correlated does not hold: event 'timer_tick' does not correlate with the suspended wait event 'reviewer_response'",
    );
    expect(m.fire("resume_correlated_wait").reason).toBe(
      "resume_correlated_wait guard waits_correlated does not hold: no resume event supplied",
    );
    expect(m.state).toBe("waiting");
    // the correlated event resumes the wait
    expect(m.fire("resume_correlated_wait", "reviewer_response").ok).toBe(true);
    expect(m.state).toBe("running");
    expect(m.waitRecord).toBeNull();
  });

  it("TypeScript conformance test: assert invariant cancellation_semantics_defined at its trust boundary and under its stated edge cases.", () => {
    expect(cancellationSemanticsDefined(validDefinition()).ok).toBe(true);
    // edge case: no cancellation semantics declared
    expect(cancellationSemanticsDefined(validDefinition({ cancellation: null })).reason).toBe(
      "process declares no cancellation semantics",
    );
    // machine boundary: cancellation fires when semantics are declared
    const m = toRunning(validDefinition());
    expect(m.fire("cancel_process").ok).toBe(true);
    expect(m.state).toBe("cancelled");
    // machine boundary: cancellation is refused, precisely, when semantics are absent
    const bad = toRunning(validDefinition({ cancellation: null, resumeEvents: [] }));
    const rb = bad.fire("cancel_process");
    expect(rb.ok).toBe(false);
    expect(rb.reason).toBe(
      "cancel_process guard cancellation_semantics_defined does not hold: process declares no cancellation semantics",
    );
    expect(bad.state).toBe("running");
    // a process with declared cancellation semantics cannot take the generic failed terminal
    const cancellable = toRunning(validDefinition({ resumeEvents: [] }));
    expect(cancellable.fire("fail_process", "x").reason).toBe(
      "fail_process guard ¬(completion_criteria_explicit ∨ waits_correlated ∨ cancellation_semantics_defined) evaluates false: cancellation_semantics_defined holds",
    );
  });

  it("TypeScript conformance test: assert invariant process_state_not_ui_state at its trust boundary and under its stated edge cases.", () => {
    const m = toRunning(validDefinition());
    m.evaluateCompletion("reviewer_signoff");
    const historyBefore = [...m.history];
    const evaluatedBefore = [...m.evaluatedConditions];
    // presentation-only changes leave the underlying process untouched
    m.notePresentation("progress bar at 90%");
    expect(m.presentationState).toBe("progress bar at 90%");
    expect(m.state).toBe("running");
    expect(m.history).toEqual(historyBefore);
    expect(m.evaluatedConditions).toEqual(evaluatedBefore);
    // a presentation layer claiming completion cannot complete the process
    m.notePresentation("completed — success screen");
    expect(m.state).toBe("running");
    const r = m.fire("complete_process");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "complete_process guard completion_criteria_explicit does not hold: completion condition 'all_checks_green' has not been evaluated successfully",
    );
    expect(m.history).toEqual(historyBefore);
    // only the domain path advances the process
    m.evaluateCompletion("all_checks_green");
    expect(m.fire("complete_process").ok).toBe(true);
    expect(m.state).toBe("completed");
  });
});