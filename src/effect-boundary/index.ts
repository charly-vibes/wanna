// Purpose: public surface of the execution and effect boundary layer
// Responsibilities: re-export the machine, executor, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createEffectBoundary, EFFECT_TRANSITIONS } from "./machine";
export type { EffectBoundaryMachine, TransitionRow } from "./machine";
export { execute, planEffects, ISOLATED_TARGET, LIVE_TARGET } from "./executor";
export type { EffectTransport, ExecutionRecord, ExecutionResult } from "./executor";
export {
  SAFE_TEST_ENVIRONMENT,
  budgetsEnforced,
  effectAuthorizationChecked,
  effectsAllowlisted,
  idempotencyOrCompensationDeclared,
  isolationOf,
  makeCompensation,
  partialFailureReported,
  previewEffectsIsolated,
  recordFailure,
  retryAllowed,
  untrustedCodeIsolated,
} from "./invariants";

export type {
  AuthorizationContext,
  Budgets,
  EffectIntent,
  EffectOutcome,
  EffectPort,
  EffectState,
  ExecutionMode,
  FailureRecord,
  FireArg,
  OutcomeRecord,
  Check,
  Isolation,
  TransitionId,
  TransitionResult,
} from "./types";
