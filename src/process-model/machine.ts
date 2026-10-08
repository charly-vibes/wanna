// Purpose: process-model state machine
// Responsibilities: the seven [[spec]] transitions (validate, start, suspend, resume, complete, fail, cancel) with their guards
// Rationale: the machine is the only mutation path; every refusal is a defined outcome naming the violated constraint — presentation state never advances the process ([[spec.process_state_not_ui_state]])
import type {
  FailureRecord,
  ProcessDefinition,
  ProcessState,
  RecoveryEdge,
  TransitionId,
  TransitionRecord,
  TransitionResult,
  WaitRecord,
} from "./types";
import { SCHEMA_VERSION } from "./types";
import {
  cancellationSemanticsDefined,
  completionCriteriaExplicit,
  conditionsAllEvaluated,
  processKindExplicit,
  resumeEventCorrelates,
  failureRecoveryEdgesExplicit,
  suspendRequiresCorrelation,
  transitionsGuarded,
} from "./invariants";
import type { Check } from "./invariants";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: ProcessState;
  readonly to: ProcessState;
}

export const PROCESS_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_process", from: "draft", to: "validated" },
  { id: "start_process", from: "validated", to: "running" },
  { id: "suspend_process", from: "running", to: "waiting" },
  { id: "resume_correlated_wait", from: "waiting", to: "running" },
  { id: "complete_process", from: "running", to: "completed" },
  { id: "fail_process", from: "running", to: "failed" },
  { id: "cancel_process", from: "running", to: "cancelled" },
];

export interface ProcessMachine {
  readonly definition: ProcessDefinition;
  readonly state: ProcessState;
  readonly history: readonly TransitionRecord[];
  readonly waitRecord: WaitRecord | null;
  readonly failureRecord: FailureRecord | null;
  readonly evaluatedConditions: readonly string[];
  readonly presentationState: string | null;
  fire(id: TransitionId, arg?: string): TransitionResult;
  evaluateCompletion(condition: string): void;
  notePresentation(view: string): void;
}

interface Internals {
  state: ProcessState;
  history: TransitionRecord[];
  waitRecord: WaitRecord | null;
  failureRecord: FailureRecord | null;
  evaluated: string[];
  presentationState: string | null;
}

function refused(reason: string): TransitionResult {
  return { ok: false, reason };
}

function accepted(): TransitionResult {
  return { ok: true };
}

function guarded(check: Check, refusal: string): TransitionResult {
  return check.ok ? accepted() : refused(`${refusal}: ${check.reason}`);
}

function buildFailureRecord(def: ProcessDefinition, detail: string): FailureRecord {
  const recoveryEdges: readonly RecoveryEdge[] = def.failureEdges ? [...def.failureEdges.recovery] : [];
  return {
    detail,
    provenance: {
      processId: def.processId,
      schemaVersion: def.schemaVersion ?? "",
      modelKind: def.modelKind ?? "",
      fromState: "running",
      transition: "fail_process",
    },
    recoveryEdges,
  };
}

function failBlockers(def: ProcessDefinition, evaluated: readonly string[]): string[] {
  const blockers: string[] = [];
  if (def.completionConditions.length > 0 && conditionsAllEvaluated(def, evaluated).ok) {
    blockers.push("completion_criteria_explicit");
  }
  if (def.resumeEvents.length > 0) blockers.push("waits_correlated");
  if (cancellationSemanticsDefined(def).ok) blockers.push("cancellation_semantics_defined");
  return blockers;
}

function failGuard(def: ProcessDefinition, internals: Internals, detail: string | undefined): TransitionResult {
  if (typeof detail !== "string" || detail.length === 0) return refused("fail_process requires failure detail");
  const blockers = failBlockers(def, internals.evaluated);
  const holds = blockers.map((b) => `${b} holds`).join(" ∧ ");
  if (blockers.length > 0) {
    return refused(
      `fail_process guard ¬(completion_criteria_explicit ∨ waits_correlated ∨ cancellation_semantics_defined) evaluates false: ${holds}`,
    );
  }
  return guarded(
    failureRecoveryEdgesExplicit(def),
    "fail_process guard failure_recovery_edges_explicit does not hold",
  );
}

function guardFor(def: ProcessDefinition, internals: Internals, id: TransitionId, arg?: string): TransitionResult {
  switch (id) {
    case "validate_process":
      return guarded(completionCriteriaExplicit(def), "validate_process guard completion_criteria_explicit does not hold");
    case "start_process":
      return guarded(transitionsGuarded(def), "start_process guard transitions_guarded does not hold");
    case "suspend_process":
      return suspendRequiresCorrelation(arg).ok
        ? accepted()
        : refused("suspend_process guard waits_correlated does not hold: no correlated resume event supplied");
    case "resume_correlated_wait":
      return guarded(resumeEventCorrelates(internals.waitRecord, arg), "resume_correlated_wait guard waits_correlated does not hold");
    case "complete_process":
      return guarded(conditionsAllEvaluated(def, internals.evaluated), "complete_process guard completion_criteria_explicit does not hold");
    case "fail_process":
      return failGuard(def, internals, arg);
    case "cancel_process":
      return guarded(cancellationSemanticsDefined(def), "cancel_process guard cancellation_semantics_defined does not hold");
  }
}

function applyEffect(internals: Internals, def: ProcessDefinition, id: TransitionId, from: ProcessState, to: ProcessState, arg?: string): void {
  internals.state = to;
  internals.history.push({ id, from, to });
  if (id === "suspend_process" && typeof arg === "string") internals.waitRecord = { resumeEvent: arg };
  if (id === "resume_correlated_wait") internals.waitRecord = null;
  if (id === "fail_process" && typeof arg === "string") internals.failureRecord = buildFailureRecord(def, arg);
}

function fire(internals: Internals, def: ProcessDefinition, id: TransitionId, arg?: string): TransitionResult {
  const row = PROCESS_TRANSITIONS.find((r) => r.id === id);
  if (!row) return refused(`unknown transition: ${String(id)}`);
  if (internals.state !== row.from) {
    return refused(`transition ${id} requires state ${row.from} but process is ${internals.state}`);
  }
  const guard = guardFor(def, internals, id, arg);
  if (!guard.ok) return guard;
  applyEffect(internals, def, id, row.from, row.to, arg);
  return accepted();
}

export function createProcessMachine(definition: ProcessDefinition): ProcessMachine {
  // trust boundary: every admitted process definition declares its model kind and schema version
  const kind = processKindExplicit(definition);
  if (!kind.ok) throw new Error(kind.reason);
  const internals: Internals = {
    state: "draft",
    history: [],
    waitRecord: null,
    failureRecord: null,
    evaluated: [],
    presentationState: null,
  };
  return {
    definition,
    get state() { return internals.state; },
    get history() { return internals.history; },
    get waitRecord() { return internals.waitRecord; },
    get failureRecord() { return internals.failureRecord; },
    get evaluatedConditions() { return internals.evaluated; },
    get presentationState() { return internals.presentationState; },
    fire: (id, arg) => fire(internals, definition, id, arg),
    evaluateCompletion: (condition) => {
      if (!internals.evaluated.includes(condition)) internals.evaluated.push(condition);
    },
    notePresentation: (view) => {
      // presentation state is recorded, never allowed to advance or complete the process
      internals.presentationState = view;
    },
  };
}

export { SCHEMA_VERSION };