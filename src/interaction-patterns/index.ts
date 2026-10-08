// Purpose: public surface of the interaction-patterns layer
// Responsibilities: re-export the machine, guards, invariants, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createPatternMachine, PATTERN_TRANSITIONS } from "./machine";
export type { PatternMachine, TransitionRow } from "./machine";
export { guardFor } from "./guards";
export type { GuardContext, PatternRuntime } from "./guards";
export {
  PATTERNS_PRESENTATION_VOCABULARY,
  PATTERN_FAILURE_EFFECT,
  clarificationHasTarget,
  conditionDeclared,
  diagnosisIsBounded,
  isTerminal,
  patternCompletionExplicit,
  patternComposesPrimitives,
  patternDoesNotOverridePrimitive,
  patternStateHostNeutral,
  patternVersioned,
  resolveReplay,
  reviewSeparatesJudgments,
} from "./invariants";
export {
  COMPLETION_CONDITIONS,
  DIAGNOSIS_PHASES,
  JUDGMENT_KINDS,
  PATTERN_KINDS,
} from "./types";
export type {
  AwaitingRecord,
  CancellationRecord,
  Check,
  CompletionCondition,
  DiagnosisPhase,
  FailureRecord,
  JudgmentKind,
  PatternDefinition,
  PatternKind,
  PatternNode,
  PatternState,
  PatternTransitionId,
  ProcessEdge,
  StepRecord,
  TransitionRecord,
  TransitionResult,
  UnresolvedRecord,
} from "./types";
