// Purpose: vocabulary and record shapes for the interaction-patterns layer
// Responsibilities: pattern kinds, completion conditions, judgment kinds, diagnosis phases, node/edge/definition records, state and transition types
// Rationale: patterns are process compositions over contribution primitives — typed records, never presentation-shaped data
export const PATTERN_KINDS = [
  "clarification", "review", "diagnosis", "planning", "monitoring",
  "coordination", "preference_teaching", "conflict_resolution",
  "recovery_assistance", "generic",
] as const;

export type PatternKind = (typeof PATTERN_KINDS)[number];

export type CompletionCondition =
  | "success" | "rejection" | "cancellation" | "deferral" | "failure" | "unresolved";

export const COMPLETION_CONDITIONS: readonly CompletionCondition[] = [
  "success", "rejection", "cancellation", "deferral", "failure", "unresolved",
];

export type JudgmentKind =
  | "inspection" | "evaluation" | "verification" | "annotation" | "rejection" | "authorization";

export const JUDGMENT_KINDS: readonly JudgmentKind[] = [
  "inspection", "evaluation", "verification", "annotation", "rejection", "authorization",
];

export type DiagnosisPhase = "inspect" | "hypothesis" | "evidence" | "correction" | "exit";

export const DIAGNOSIS_PHASES: readonly DiagnosisPhase[] = [
  "inspect", "hypothesis", "evidence", "correction", "exit",
];

export interface PatternNode {
  readonly id: string;
  readonly primitiveId: string;
  readonly primitiveVersion: string;
  /** review patterns only: the distinct judgment this node carries */
  readonly judgmentKind?: JudgmentKind;
  /** diagnosis patterns only: the phase this node models */
  readonly diagnosisPhase?: DiagnosisPhase;
  /** clarification steps only: the ambiguity, missing fact, conflict, or decision the response reduces */
  readonly unresolvedTarget?: string;
}

export interface ProcessEdge {
  readonly from: string;
  readonly to: string;
}

export interface PatternDefinition {
  readonly patternId: string;
  readonly kind: PatternKind;
  readonly version: string;
  readonly nodes: readonly PatternNode[];
  readonly edges: readonly ProcessEdge[];
  readonly conditions: readonly CompletionCondition[];
  readonly successWhen: readonly string[];
  /** where applicable: pattern-level capability flags make a condition applicable */
  readonly cancellable?: boolean;
  readonly supportsRejection?: boolean;
  readonly supportsDeferral?: boolean;
  /** diagnosis patterns: bounded loop termination */
  readonly maxIterations?: number;
  /** diagnosis patterns: externally interruptible termination */
  readonly interruptible?: boolean;
  /** free-text summary — must stay host-neutral (see pattern_state_host_neutral) */
  readonly summary?: string;
}

export type PatternState =
  | "draft" | "validated" | "running" | "waiting"
  | "completed" | "unresolved" | "cancelled" | "failed";

export type PatternTransitionId =
  | "validate_pattern"
  | "start_pattern"
  | "wait_for_contribution"
  | "resume_pattern"
  | "complete_pattern"
  | "preserve_unresolved_pattern"
  | "cancel_pattern"
  | "fail_pattern";

export interface TransitionRecord {
  readonly id: string;
  readonly from: PatternState;
  readonly to: PatternState;
  readonly patternVersion: string;
}

export interface StepRecord {
  readonly nodeId: string;
  readonly primitiveId: string;
  readonly judgmentKind?: JudgmentKind;
  readonly patternVersion: string;
}

export interface AwaitingRecord {
  readonly nodeId: string;
}

export interface UnresolvedRecord {
  readonly patternId: string;
  readonly patternVersion: string;
  readonly reason: string;
}

export interface CancellationRecord {
  readonly patternId: string;
  readonly patternVersion: string;
  readonly reason: string;
}

export interface FailureRecord {
  readonly effect: string;
  readonly detail: string;
  readonly patternId: string;
  readonly patternVersion: string;
}

export const PATTERN_FAILURE_EFFECT = "interaction.patterns.pattern_failure";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export interface Check {
  readonly ok: boolean;
  readonly reason?: string;
}
