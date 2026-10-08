// Purpose: interaction-policy state machine
// Responsibilities: the seven declared transitions with their guards, plus evaluate() and the typed retry entries
// Rationale: mirrors the spec Model table row for row and refuses imprecise failures — every guard violation names its row and unmet condition
import type {
  EvaluationOutcome,
  PolicyInput,
  PolicyResult,
  PolicyState,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  buildResult,
  contextChanged,
  countEligible,
  policyInputValid,
} from "./invariants";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: PolicyState;
  readonly to: PolicyState;
}

export const POLICY_TRANSITIONS: readonly TransitionRow[] = [
  { id: "begin_valid_evaluation", from: "ready", to: "evaluating" },
  { id: "reject_invalid_input", from: "ready", to: "failed" },
  { id: "return_ranked_candidates", from: "evaluating", to: "recommended" },
  { id: "return_no_candidate", from: "evaluating", to: "no_candidate" },
  { id: "reevaluate_after_recommendation", from: "recommended", to: "ready" },
  { id: "retry_after_empty_result", from: "no_candidate", to: "ready" },
  { id: "retry_after_failure", from: "failed", to: "ready" },
];

export interface PolicyMachine {
  readonly state: PolicyState;
  readonly lastResult: PolicyResult | null;
  readonly rejectionReason: string | null;
  readonly lastInput: PolicyInput;
  fire(id: TransitionId): TransitionResult;
  evaluate(): EvaluationOutcome;
  requestReevaluation(): TransitionResult;
  retryWithNewContext(next: PolicyInput["context"]): TransitionResult;
  retryWithCorrectedInput(next: PolicyInput): TransitionResult;
}

export interface Internals {
  state: PolicyState;
  input: PolicyInput;
  lastResult: PolicyResult | null;
  rejectionReason: string | null;
  reevaluationRequested: boolean;
  pendingContext: PolicyInput["context"] | null;
  pendingCorrected: PolicyInput | null;
}

type GuardFn = (s: Internals) => TransitionResult;

const GUARDS: Readonly<Record<TransitionId, GuardFn>> = {
  begin_valid_evaluation: (s) => policyInputValid(s.input),
  reject_invalid_input: (s) =>
    policyInputValid(s.input).ok
      ? { ok: false, reason: "guard reject_invalid_input requires ¬policy_input_valid, but the input is valid" }
      : { ok: true },
  return_ranked_candidates: (s) =>
    countEligible(s.input) > 0
      ? { ok: true }
      : { ok: false, reason: "guard eligible_candidate_exists fails: no candidate passed every eligibility gate" },
  return_no_candidate: (s) => {
    const n = countEligible(s.input);
    return n === 0
      ? { ok: true }
      : { ok: false, reason: `guard ¬eligible_candidate_exists fails: ${n} candidates are eligible` };
  },
  reevaluate_after_recommendation: (s) =>
    s.reevaluationRequested
      ? { ok: true }
      : { ok: false, reason: "guard reevaluation_requested fails: no explicit reevaluation or changed-context request recorded" },
  retry_after_empty_result: (s) =>
    s.pendingContext === null
      ? { ok: false, reason: "guard new_context_received fails: no new context supplied" }
      : contextChanged(s.input.context, s.pendingContext),
  retry_after_failure: (s) => {
    const corrected = s.pendingCorrected === null
      ? { ok: false, reason: "guard corrected_input_received fails: no corrected input supplied" }
      : policyInputValid(s.pendingCorrected);
    return corrected.ok ? { ok: true } : { ok: false, reason: `guard corrected_input_received fails: ${corrected.reason}` };
  },
};

type EffectFn = (s: Internals) => void;

const EFFECTS: Readonly<Partial<Record<TransitionId, EffectFn>>> = {
  reject_invalid_input: (s) => {
    s.rejectionReason = policyInputValid(s.input).reason ?? "invalid input";
  },
  return_ranked_candidates: (s) => {
    s.lastResult = buildResult("recommended", s.input);
  },
  return_no_candidate: (s) => {
    s.lastResult = buildResult("no_candidate", s.input);
  },
  reevaluate_after_recommendation: (s) => {
    s.reevaluationRequested = false;
  },
  retry_after_empty_result: (s) => {
    const next = s.pendingContext;
    s.pendingContext = null;
    if (next) s.input = withContext(s.input, next);
  },
  retry_after_failure: (s) => {
    if (s.pendingCorrected) s.input = s.pendingCorrected;
    s.pendingCorrected = null;
    s.rejectionReason = null;
  },
};

function withContext(input: PolicyInput, next: PolicyInput["context"]): PolicyInput {
  const catalogChanged = next.catalogVersion !== undefined && next.catalogVersion !== input.catalog.version;
  return {
    ...input,
    context: next,
    catalog: catalogChanged ? { ...input.catalog, version: next.catalogVersion! } : input.catalog,
  };
}

function fireTransition(s: Internals, id: TransitionId): TransitionResult {
  const row = POLICY_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (s.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${s.state}` };
  }
  const guard = GUARDS[id](s);
  if (!guard.ok) return guard;
  s.state = row.to;
  EFFECTS[id]?.(s);
  return { ok: true };
}

function evaluateFrom(s: Internals): EvaluationOutcome {
  if (policyInputValid(s.input).ok) {
    fireTransition(s, "begin_valid_evaluation");
    fireTransition(s, countEligible(s.input) > 0 ? "return_ranked_candidates" : "return_no_candidate");
    return s.lastResult !== null ? { ok: true, result: s.lastResult } : { ok: false, reason: "evaluation produced no result" };
  }
  fireTransition(s, "reject_invalid_input");
  return { ok: false, reason: policyInputValid(s.input).reason ?? "policy_input_valid fails" };
}

function evaluateOnlyFromReady(s: Internals): EvaluationOutcome {
  return s.state === "ready"
    ? evaluateFrom(s)
    : { ok: false, reason: `evaluation cannot begin from state ${s.state}` };
}

function makeMachine(s: Internals): PolicyMachine {
  const actions = makeActions(s);
  return {
    get state() {
      return s.state;
    },
    get lastResult() {
      return s.lastResult;
    },
    get rejectionReason() {
      return s.rejectionReason;
    },
    get lastInput() {
      return s.input;
    },
    fire: actions.fire,
    evaluate: actions.evaluate,
    requestReevaluation: actions.requestReevaluation,
    retryWithNewContext: actions.retryWithNewContext,
    retryWithCorrectedInput: actions.retryWithCorrectedInput,
  };
}

function makeActions(s: Internals): Omit<PolicyMachine, keyof ReturnType<typeof makeGetters>> {
  return {
    fire: (id) => fireTransition(s, id),
    evaluate: () => evaluateOnlyFromReady(s),
    requestReevaluation: () => {
      if (s.state !== "recommended") {
        return { ok: false, reason: `reevaluate_after_recommendation cannot fire from state ${s.state}` };
      }
      s.reevaluationRequested = true;
      return fireTransition(s, "reevaluate_after_recommendation");
    },
    retryWithNewContext: (next) => {
      if (s.state !== "no_candidate") {
        return { ok: false, reason: `retry_after_empty_result cannot fire from state ${s.state}` };
      }
      s.pendingContext = next;
      const r = fireTransition(s, "retry_after_empty_result");
      if (!r.ok) s.pendingContext = null;
      return r;
    },
    retryWithCorrectedInput: (next) => {
      if (s.state !== "failed") {
        return { ok: false, reason: `retry_after_failure cannot fire from state ${s.state}` };
      }
      s.pendingCorrected = next;
      const r = fireTransition(s, "retry_after_failure");
      if (!r.ok) s.pendingCorrected = null;
      return r;
    },
  };
}

export function createPolicyMachine(input: PolicyInput): PolicyMachine {
  const s: Internals = {
    state: "ready",
    input,
    lastResult: null,
    rejectionReason: null,
    reevaluationRequested: false,
    pendingContext: null,
    pendingCorrected: null,
  };
  return makeMachine(s);
}