// Purpose: test fixtures for the process-model layer
// Responsibilities: build canonical valid process definitions and the invalid variants the corpus properties name
// Rationale: single source of shared process vocabulary for transitions and properties tests
import { createProcessMachine } from "../../src/process-model/machine";
import type { ProcessDefinition, ProcessMachine } from "../../src/process-model/machine";
import { SCHEMA_VERSION, TRANSITION_IDS } from "../../src/process-model/types";

export function refusalOutcomes(): Record<string, string> {
  return {
    validate_process: "block validation until completion criteria are declared",
    start_process: "block start until every transition declares a refusal outcome",
    suspend_process: "block suspension without a correlated resume event",
    resume_correlated_wait: "block resumption by events uncorrelated with the suspended wait",
    complete_process: "block completion until every declared condition evaluates successfully",
    fail_process: "block generic failure when declared semantics hold",
    cancel_process: "block cancellation without declared cancellation semantics",
  };
}

export function validDefinition(overrides: Partial<ProcessDefinition> = {}): ProcessDefinition {
  return {
    processId: "proc-1",
    modelKind: "finite_state_workflow",
    schemaVersion: SCHEMA_VERSION,
    completionConditions: ["reviewer_signoff", "all_checks_green"],
    resumeEvents: ["reviewer_response"],
    cancellation: { discardedLocalState: ["scratch_buffer"], compensableExternalEffects: [] },
    dependencies: {
      nodes: ["collect", "analyze", "report"],
      edges: [{ from: "collect", to: "analyze" }, { from: "analyze", to: "report" }],
    },
    boundedLoop: null,
    externalEffects: [],
    failureEdges: null,
    transitionRefusals: refusalOutcomes(),
    interactionPattern: null,
    ...overrides,
  };
}

// A definition that can legally reach `running` and then legally fail: completion
// criteria are declared (validate passes) but nothing else is declared — no
// correlated waits, no cancellation semantics, no external effects.
export function failibleDefinition(overrides: Partial<ProcessDefinition> = {}): ProcessDefinition {
  return validDefinition({
    processId: "proc-fail",
    completionConditions: ["reviewer_signoff"],
    resumeEvents: [],
    cancellation: null,
    externalEffects: [],
    failureEdges: null,
    ...overrides,
  });
}

export function toRunning(definition: ProcessDefinition): ProcessMachine {
  const machine = createProcessMachine(definition);
  machine.fire("validate_process");
  machine.fire("start_process");
  return machine;
}

export { TRANSITION_IDS };