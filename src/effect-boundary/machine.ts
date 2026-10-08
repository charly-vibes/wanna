// Purpose: execution and effect boundary state machine
// Responsibilities: the six model transitions (authorize, start, complete, fail, report-partial, cancel) with their guards
// Rationale: every outcome path is an explicit transition; guards fail with precise reasons so bypasses cannot hide behind vague refusals
import type {
  AuthorizationContext,
  EffectIntent,
  EffectState,
  ExecutorConfig,
  FailureRecord,
  FireArg,
  OutcomeRecord,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  effectAuthorizationChecked,
  effectsAllowlisted,
  idempotencyOrCompensationDeclared,
  partialFailureReported,
  previewEffectsIsolated,
  recordFailure,
} from "./invariants";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: EffectState;
  readonly to: EffectState;
}

export const EFFECT_TRANSITIONS: readonly TransitionRow[] = [
  { id: "authorize_effect", from: "proposed", to: "authorized" },
  { id: "start_effect", from: "authorized", to: "running" },
  { id: "complete_effect", from: "running", to: "succeeded" },
  { id: "fail_effect", from: "running", to: "failed" },
  { id: "report_partial_effect", from: "running", to: "partial" },
  { id: "cancel_effect", from: "authorized", to: "cancelled" },
];

export interface EffectBoundaryMachine {
  readonly intent: EffectIntent;
  readonly config: ExecutorConfig;
  readonly state: EffectState;
  readonly authorization: AuthorizationContext | null;
  readonly outcome: OutcomeRecord | null;
  readonly failure: FailureRecord | null;
  fire(id: TransitionId, arg?: FireArg): TransitionResult;
}

interface Internals {
  intent: EffectIntent;
  config: ExecutorConfig;
  state: EffectState;
  authorization: AuthorizationContext | null;
  outcome: OutcomeRecord | null;
  failure: FailureRecord | null;
}

type Guard = (internals: Internals, arg: FireArg | undefined) => TransitionResult;

type ArgOutcome = { ok: true; outcome: OutcomeRecord } | { ok: false; reason: string };

function argOutcome(id: TransitionId, arg: FireArg | undefined): ArgOutcome {
  if (arg?.kind !== "outcome") return { ok: false, reason: `${id} requires an outcome record` };
  return { ok: true, outcome: arg.outcome };
}

function guardAuthorize(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  if (arg?.kind !== "authorization") {
    return { ok: false, reason: "authorize_effect requires an authorization context" };
  }
  return effectAuthorizationChecked(arg.authorization);
}

function guardStart(internals: Internals): TransitionResult {
  return effectsAllowlisted(internals.intent, internals.config);
}

const NOT_DECLARED =
  "idempotency_or_compensation_declared does not hold: the effect declares neither an idempotency key nor a compensation strategy";

function guardComplete(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argOutcome("complete_effect", arg);
  if (!a.ok) return a;
  if (!idempotencyOrCompensationDeclared(_internals.intent)) {
    return { ok: false, reason: NOT_DECLARED };
  }
  return { ok: true };
}

const NO_IDEM = "fail_effect guard does not hold: idempotency_or_compensation_declared holds — use complete_effect or the reconciliation path";
const PARTIAL_HELD = "fail_effect guard does not hold: partial_failure_reported holds — use report_partial_effect";

function guardFail(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argOutcome("fail_effect", arg);
  if (!a.ok) return a;
  if (idempotencyOrCompensationDeclared(_internals.intent)) return { ok: false, reason: NO_IDEM };
  if (partialFailureReported(a.outcome).ok) return { ok: false, reason: PARTIAL_HELD };
  if (a.outcome.evidence.length === 0) {
    return { ok: false, reason: "fail_effect requires evidence for the typed failure" };
  }
  return { ok: true };
}

function guardPartial(_internals: Internals, arg: FireArg | undefined): TransitionResult {
  const a = argOutcome("report_partial_effect", arg);
  if (!a.ok) return a;
  return partialFailureReported(a.outcome);
}

function guardCancel(_internals: Internals): TransitionResult {
  if (previewEffectsIsolated(_internals.intent)) return { ok: true };
  return {
    ok: false,
    reason: "preview_effects_isolated does not hold: the authorized effect runs live — cancellation applies only to isolated preview/shadow effects",
  };
}

const GUARDS: Readonly<Record<TransitionId, Guard>> = {
  authorize_effect: guardAuthorize,
  start_effect: guardStart,
  complete_effect: guardComplete,
  fail_effect: guardFail,
  report_partial_effect: guardPartial,
  cancel_effect: guardCancel,
};

function apply(internals: Internals, id: TransitionId, arg: FireArg | undefined): void {
  if (id === "authorize_effect" && arg?.kind === "authorization") {
    internals.authorization = arg.authorization;
  }
  if ((id === "complete_effect" || id === "report_partial_effect") && arg?.kind === "outcome") {
    internals.outcome = arg.outcome;
  }
  if (id === "fail_effect" && arg?.kind === "outcome") {
    internals.failure = recordFailure(internals.intent, arg.outcome);
  }
  internals.state = EFFECT_TRANSITIONS.find((r) => r.id === id)!.to;
}

function fireTransition(internals: Internals, id: TransitionId, arg: FireArg | undefined): TransitionResult {
  const row = EFFECT_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = GUARDS[id](internals, arg);
  if (!guard.ok) return guard;
  apply(internals, id, arg);
  return { ok: true };
}

function makeMachine(internals: Internals): EffectBoundaryMachine {
  return {
    get intent() {
      return internals.intent;
    },
    get config() {
      return internals.config;
    },
    get state() {
      return internals.state;
    },
    get authorization() {
      return internals.authorization;
    },
    get outcome() {
      return internals.outcome;
    },
    get failure() {
      return internals.failure;
    },
    fire: (id, arg) => fireTransition(internals, id, arg),
  };
}

export function createEffectBoundary(intent: EffectIntent, config: ExecutorConfig): EffectBoundaryMachine {
  return makeMachine({
    intent,
    config,
    state: "proposed",
    authorization: null,
    outcome: null,
    failure: null,
  });
}
