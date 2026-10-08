// Purpose: cognitive-ergonomics state machine
// Responsibilities: the six transitions (propose, admit, block, apply, defer, revert) with their guards
// Rationale: guards are negation-exact — block and defer fire only when their positive guard fails,
//   and every refusal names the precise guard and cause
import type {
  AdaptationRequest,
  ErgonomicsState,
  RevertRecord,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  adaptationExplainableAndOverridable,
  adaptationTemporallyStable,
  interruptionHasValueTest,
  measurableBurdenSeparated,
} from "./invariants";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: ErgonomicsState;
  readonly to: ErgonomicsState;
}

export const ERGONOMICS_TRANSITIONS: readonly TransitionRow[] = [
  { id: "propose_adaptation", from: "baseline", to: "candidate_adaptation" },
  { id: "admit_stable_adaptation", from: "candidate_adaptation", to: "eligible" },
  { id: "block_disruptive_adaptation", from: "candidate_adaptation", to: "blocked" },
  { id: "apply_adaptation", from: "eligible", to: "applied" },
  { id: "defer_interruption", from: "eligible", to: "deferred" },
  { id: "revert_adaptation", from: "applied", to: "reverted" },
];

const BLOCK_REFUSAL =
  "block_disruptive_adaptation requires a disruptive adaptation — adaptation_temporally_stable holds, so nothing is blocked";

const DEFER_REFUSAL =
  "defer_interruption requires an interruption that fails the value test — need, benefit, urgency, and deferral rationale are all recorded";

interface Internals {
  state: ErgonomicsState;
  request: AdaptationRequest;
  blockReason: string | null;
  appliedAdaptation: AdaptationRequest["adaptation"] | null;
  deferralRecord: string | null;
  revertRecord: RevertRecord | null;
}

type GuardFn = (request: AdaptationRequest) => TransitionResult;

function blockGuard(request: AdaptationRequest): TransitionResult {
  return adaptationTemporallyStable(request.adaptation).ok
    ? { ok: false, reason: BLOCK_REFUSAL }
    : { ok: true };
}

function deferGuard(request: AdaptationRequest): TransitionResult {
  const { interruption } = request;
  return interruption && interruptionHasValueTest(interruption).ok
    ? { ok: false, reason: DEFER_REFUSAL }
    : { ok: true };
}

function revertGuard(request: AdaptationRequest): TransitionResult {
  return request.revertReason
    ? { ok: true }
    : {
        ok: false,
        reason: "guard adaptation_explainable_and_overridable does not hold: the revert records no reason",
      };
}

const GUARDS: Record<TransitionId, GuardFn> = {
  propose_adaptation: (request) => measurableBurdenSeparated(request),
  admit_stable_adaptation: (request) => adaptationTemporallyStable(request.adaptation),
  block_disruptive_adaptation: blockGuard,
  apply_adaptation: (request) => adaptationExplainableAndOverridable(request.adaptation),
  defer_interruption: deferGuard,
  revert_adaptation: revertGuard,
};

function guardHolds(id: TransitionId, request: AdaptationRequest): TransitionResult {
  return GUARDS[id](request);
}

function applyEffect(internals: Internals, id: TransitionId): void {
  const request = internals.request;
  if (id === "propose_adaptation") {
    internals.state = "candidate_adaptation";
    return;
  }
  if (id === "admit_stable_adaptation") {
    internals.state = "eligible";
    return;
  }
  if (id === "block_disruptive_adaptation") {
    internals.state = "blocked";
    internals.blockReason = adaptationTemporallyStable(request.adaptation).reason ?? "disruptive adaptation";
    return;
  }
  if (id === "apply_adaptation") {
    internals.state = "applied";
    internals.appliedAdaptation = request.adaptation;
    return;
  }
  if (id === "defer_interruption") {
    internals.state = "deferred";
    internals.deferralRecord =
      (request.interruption && interruptionHasValueTest(request.interruption).reason) ??
      "interruption value test fails: no recorded unresolved need";
    return;
  }
  internals.state = "reverted";
  internals.revertRecord = { adaptationId: request.adaptation.adaptationId, reason: request.revertReason ?? "" };
}

function fireTransition(internals: Internals, id: TransitionId): TransitionResult {
  const row = ERGONOMICS_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(id, internals.request);
  if (!guard.ok) return guard;
  applyEffect(internals, id);
  return { ok: true };
}

function makeMachine(internals: Internals) {
  return {
    get request() {
      return internals.request;
    },
    get state() {
      return internals.state;
    },
    get blockReason() {
      return internals.blockReason;
    },
    get appliedAdaptation() {
      return internals.appliedAdaptation;
    },
    get deferralRecord() {
      return internals.deferralRecord;
    },
    get revertRecord() {
      return internals.revertRecord;
    },
    fire: (id: TransitionId): TransitionResult => fireTransition(internals, id),
  };
}

export type AdaptationMachine = ReturnType<typeof makeMachine>;

export function createAdaptationMachine(request: AdaptationRequest): AdaptationMachine {
  const internals: Internals = {
    state: "baseline",
    request,
    blockReason: null,
    appliedAdaptation: null,
    deferralRecord: null,
    revertRecord: null,
  };
  return makeMachine(internals);
}
