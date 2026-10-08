// Purpose: failure model state machine
// Responsibilities: the six model transitions (contain, assess, classify-known, classify-uncertain, resolve, escalate) with their guards
// Rationale: failure is ordinary runtime state — every outcome path is an explicit transition and the machine holds no mutation channel
import type {
  AppliedTransition,
  FailureAssessment,
  FailureRecord,
  FailureState,
  FireArg,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  effectCertaintyExplicit,
  failureIsTyped,
  knownClassifiable,
  recoverabilityExplicit,
  retrySafetyHolds,
  uncertainClassifiable,
} from "./invariants";

export const FAILURE_MODEL_VERSION = "failure-model@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: FailureState;
  readonly to: FailureState;
}

export const FAILURE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "contain_failure", from: "detected", to: "contained" },
  { id: "assess_failure", from: "contained", to: "assessing" },
  { id: "classify_known_failure", from: "assessing", to: "known" },
  { id: "classify_uncertain_failure", from: "assessing", to: "uncertain" },
  { id: "resolve_known_failure", from: "known", to: "resolved" },
  { id: "escalate_uncertain_failure", from: "uncertain", to: "escalated" },
];

export interface FailureModelMachine {
  readonly state: FailureState;
  readonly record: FailureRecord | null;
  readonly assessment: FailureAssessment | null;
  readonly applied: readonly AppliedTransition[];
  /** Authoritative-state mutations performed by this machine — always empty by construction. */
  readonly mutations: readonly string[];
  fire(id: TransitionId, arg?: FireArg): TransitionResult;
}

interface Internals {
  state: FailureState;
  record: FailureRecord | null;
  assessment: FailureAssessment | null;
  applied: AppliedTransition[];
}

function argAssessment(id: TransitionId, arg: FireArg | undefined): FailureAssessment | null {
  return arg?.kind === "assessment" ? arg.assessment : null;
}

function argRecord(arg: FireArg | undefined): FailureRecord | null {
  return arg?.kind === "record" ? arg.record : null;
}

type Guard = (internals: Internals, arg: FireArg | undefined) => TransitionResult;

function guardContain(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const record = argRecord(arg);
  if (!record) return { ok: false, reason: "contain_failure requires a failure record" };
  return failureIsTyped(record);
}

function guardAssess(internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argAssessment("assess_failure", arg);
  if (!a) return { ok: false, reason: "assess_failure requires an assessment" };
  return effectCertaintyExplicit(internals.record!, a);
}

function guardClassifyKnown(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argAssessment("classify_known_failure", arg);
  if (!a) return { ok: false, reason: "classify_known_failure requires an assessment" };
  return knownClassifiable(a);
}

function guardClassifyUncertain(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argAssessment("classify_uncertain_failure", arg);
  if (!a) return { ok: false, reason: "classify_uncertain_failure requires an assessment" };
  return uncertainClassifiable(a);
}

function guardResolve(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argAssessment("resolve_known_failure", arg);
  if (!a) return { ok: false, reason: "resolve_known_failure requires an assessment" };
  return recoverabilityExplicit(a);
}

const ESCALATION_REFUSED =
  "escalate_uncertain_failure guard does not hold: retry_safety_explicit holds — retry is proven idempotent; resolve through the retry path instead of escalating";

function guardEscalate(internals: Internals, arg: FireArg | undefined): TransitionResult {
  if (arg !== undefined) {
    return { ok: false, reason: "escalate_uncertain_failure takes no argument" };
  }
  if (retrySafetyHolds(internals.record!, internals.assessment!)) {
    return { ok: false, reason: ESCALATION_REFUSED };
  }
  return { ok: true };
}

const GUARDS: Readonly<Record<TransitionId, Guard>> = {
  contain_failure: guardContain,
  assess_failure: guardAssess,
  classify_known_failure: guardClassifyKnown,
  classify_uncertain_failure: guardClassifyUncertain,
  resolve_known_failure: guardResolve,
  escalate_uncertain_failure: guardEscalate,
};

function apply(internals: Internals, id: TransitionId, arg: FireArg | undefined): void {
  const record = argRecord(arg);
  if (record) internals.record = record;
  const assessment = argAssessment(id, arg);
  if (assessment) internals.assessment = assessment;
  const row = FAILURE_TRANSITIONS.find((r) => r.id === id)!;
  internals.state = row.to;
  internals.applied = [...internals.applied, { id, from: row.from, to: row.to }];
}

function fireTransition(internals: Internals, id: TransitionId, arg: FireArg | undefined): TransitionResult {
  const row = FAILURE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = GUARDS[id](internals, arg);
  if (!guard.ok) return guard;
  apply(internals, id, arg);
  return { ok: true };
}

function makeMachine(internals: Internals): FailureModelMachine {
  return {
    get state() {
      return internals.state;
    },
    get record() {
      return internals.record;
    },
    get assessment() {
      return internals.assessment;
    },
    get applied() {
      return internals.applied;
    },
    get mutations() {
      return [];
    },
    fire: (id, arg) => fireTransition(internals, id, arg),
  };
}

export function createFailureModel(record: FailureRecord): FailureModelMachine {
  const internals: Internals = {
    state: "detected",
    record,
    assessment: null,
    applied: [],
  };
  return makeMachine(internals);
}
