// Purpose: interaction-patterns state machine
// Responsibilities: the eight declared transitions (validate, start, wait, resume, complete, preserve-unresolved, cancel, fail) with their guards, plus step recording and versioned definition revision
// Rationale: the machine mirrors the spec Model table row for row and refuses imprecise failures — every guard violation names its row
import type {
  AwaitingRecord,
  CancellationRecord,
  FailureRecord,
  PatternDefinition,
  PatternState,
  PatternTransitionId,
  StepRecord,
  TransitionRecord,
  TransitionResult,
  UnresolvedRecord,
} from "./types";
import { PATTERN_FAILURE_EFFECT } from "./types";
import { patternVersioned } from "./invariants";
import { guardFor, reviseStateAllowed } from "./guards";
import type { PatternRuntime } from "./guards";

export interface TransitionRow {
  readonly id: PatternTransitionId;
  readonly from: PatternState;
  readonly to: PatternState;
}

export const PATTERN_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_pattern", from: "draft", to: "validated" },
  { id: "start_pattern", from: "validated", to: "running" },
  { id: "wait_for_contribution", from: "running", to: "waiting" },
  { id: "resume_pattern", from: "waiting", to: "running" },
  { id: "complete_pattern", from: "running", to: "completed" },
  { id: "preserve_unresolved_pattern", from: "running", to: "unresolved" },
  { id: "cancel_pattern", from: "running", to: "cancelled" },
  { id: "fail_pattern", from: "running", to: "failed" },
];

export interface PatternMachine {
  readonly definition: PatternDefinition;
  readonly state: PatternState;
  readonly history: readonly TransitionRecord[];
  readonly stepEvents: readonly StepRecord[];
  readonly awaitingRecord: AwaitingRecord | null;
  readonly unresolvedRecord: UnresolvedRecord | null;
  readonly cancellationRecord: CancellationRecord | null;
  readonly failureRecord: FailureRecord | null;
  readonly emittedEffects: readonly FailureRecord[];
  fire(id: PatternTransitionId, arg?: string): TransitionResult;
  recordStep(nodeId: string): TransitionResult;
  revise(next: PatternDefinition): TransitionResult;
}

interface Internals {
  state: PatternState;
  def: PatternDefinition;
  registry: readonly string[];
  recorded: string[];
  awaiting: string | null;
  history: TransitionRecord[];
  stepEvents: StepRecord[];
  awaitingRecord: AwaitingRecord | null;
  unresolvedRecord: UnresolvedRecord | null;
  cancellationRecord: CancellationRecord | null;
  failureRecord: FailureRecord | null;
  emittedEffects: FailureRecord[];
}

export function createPatternMachine(def: PatternDefinition, registry: readonly string[]): PatternMachine {
  const versioned = patternVersioned(def);
  if (!versioned.ok) throw new Error(versioned.reason);
  const internals: Internals = {
    state: "draft",
    def,
    registry,
    recorded: [],
    awaiting: null,
    history: [],
    stepEvents: [],
    awaitingRecord: null,
    unresolvedRecord: null,
    cancellationRecord: null,
    failureRecord: null,
    emittedEffects: [],
  };
  return makeMachine(internals);
}

function makeMachine(i: Internals): PatternMachine {
  return {
    get definition() { return i.def; },
    get state() { return i.state; },
    get history() { return i.history; },
    get stepEvents() { return i.stepEvents; },
    get awaitingRecord() { return i.awaitingRecord; },
    get unresolvedRecord() { return i.unresolvedRecord; },
    get cancellationRecord() { return i.cancellationRecord; },
    get failureRecord() { return i.failureRecord; },
    get emittedEffects() { return i.emittedEffects; },
    fire: (id, arg) => fire(i, id, arg),
    recordStep: (nodeId) => recordStep(i, nodeId),
    revise: (next) => revise(i, next),
  };
}

function fire(i: Internals, id: PatternTransitionId, arg?: string): TransitionResult {
  const row = PATTERN_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${String(id)}` };
  if (i.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${i.state}` };
  }
  const guard = guardFor({ def: i.def, registry: i.registry, runtime: runtimeOf(i) }, id, arg);
  if (!guard.ok) return guard;
  applyEffect(i, row, arg);
  return { ok: true };
}

function runtimeOf(i: Internals): PatternRuntime {
  return { recorded: i.recorded, awaiting: i.awaiting };
}

function applyEffect(i: Internals, row: TransitionRow, arg: string | undefined): void {
  i.history.push({ id: row.id, from: row.from, to: row.to, patternVersion: i.def.version });
  i.state = row.to;
  if (row.id === "wait_for_contribution" && arg !== undefined) {
    i.awaiting = arg;
    i.awaitingRecord = { nodeId: arg };
  }
  if (row.id === "resume_pattern") {
    i.awaiting = null;
    i.awaitingRecord = null;
  }
  if (row.id === "preserve_unresolved_pattern") {
    i.unresolvedRecord = { patternId: i.def.patternId, patternVersion: i.def.version, reason: "pattern_completion_explicit does not hold for the unresolved outcome — run preserved unresolved" };
  }
  if (row.id === "cancel_pattern" && arg !== undefined) {
    i.cancellationRecord = { patternId: i.def.patternId, patternVersion: i.def.version, reason: arg };
  }
  if (row.id === "fail_pattern" && arg !== undefined) {
    recordFailure(i, arg);
  }
}

function recordFailure(i: Internals, detail: string): void {
  const failure: FailureRecord = {
    effect: PATTERN_FAILURE_EFFECT,
    detail,
    patternId: i.def.patternId,
    patternVersion: i.def.version,
  };
  i.failureRecord = failure;
  i.emittedEffects.push(failure);
}

function recordStep(i: Internals, nodeId: string): TransitionResult {
  if (i.state !== "running") {
    return { ok: false, reason: `recordStep requires state running but pattern is ${i.state}` };
  }
  const node = i.def.nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: `step "${nodeId}" is not a declared contribution node` };
  if (i.recorded.includes(nodeId)) return { ok: false, reason: `step "${nodeId}" has already completed` };
  i.recorded.push(nodeId);
  i.stepEvents.push({ nodeId, primitiveId: node.primitiveId, judgmentKind: node.judgmentKind, patternVersion: i.def.version });
  return { ok: true };
}

function revise(i: Internals, next: PatternDefinition): TransitionResult {
  if (!reviseStateAllowed(i.state)) {
    return { ok: false, reason: `revise requires state running or waiting but pattern is ${i.state}` };
  }
  const versioned = patternVersioned(next);
  if (!versioned.ok) return { ok: false, reason: `revise ${versioned.reason}` };
  if (next.version === i.def.version) {
    return { ok: false, reason: "revise requires a different pattern version for replay and audit" };
  }
  i.def = next;
  i.history.push({ id: "revise_pattern", from: i.state, to: i.state, patternVersion: next.version });
  return { ok: true };
}
