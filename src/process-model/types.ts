// Purpose: vocabulary and record shapes for the process-model layer
// Responsibilities: model kinds, schema version, states, transition ids, process definitions, wait/failure records, recovery edges, compound-activity patterns
// Rationale: process progression is modeled as typed records independent of presentation ([[spec.process_state_not_ui_state]])
export const SCHEMA_VERSION = "process-model-schema-2026.11";

export const MODEL_KINDS = ["finite_state_workflow", "dependency_dag"] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

export const PROCESS_STATES = [
  "draft", "validated", "running", "waiting", "completed", "failed", "cancelled",
] as const;
export type ProcessState = (typeof PROCESS_STATES)[number];

export const TRANSITION_IDS = [
  "validate_process", "start_process", "suspend_process", "resume_correlated_wait",
  "complete_process", "fail_process", "cancel_process",
] as const;
export type TransitionId = (typeof TRANSITION_IDS)[number];

export const RECOVERY_EDGE_TYPES = ["retry", "compensate", "escalate", "rollback"] as const;
export type RecoveryEdgeType = (typeof RECOVERY_EDGE_TYPES)[number];

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export interface RecoveryEdge {
  readonly onFailure: string;
  readonly reconciliation: string;
  readonly edgeType: RecoveryEdgeType;
}

export interface FailureEdges {
  readonly containment: string;
  readonly recovery: readonly RecoveryEdge[];
}

export interface CancellationSemantics {
  readonly discardedLocalState: readonly string[];
  readonly compensableExternalEffects: readonly string[];
}

export interface BoundedLoop {
  readonly terminationCondition: string;
  readonly maxIterations: number;
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
}

export interface DependencyGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly DependencyEdge[];
}

export const COMPOUND_ACTIVITIES = [
  "planning", "diagnosis", "review", "coordination", "monitoring", "clarification",
] as const;
export type CompoundActivity = (typeof COMPOUND_ACTIVITIES)[number];

export interface InteractionPattern {
  readonly activity: CompoundActivity;
  readonly primitives: readonly string[];
}

export interface ProcessDefinition {
  readonly processId: string;
  readonly modelKind?: string;
  readonly schemaVersion?: string;
  readonly completionConditions: readonly string[];
  readonly resumeEvents: readonly string[];
  readonly cancellation: CancellationSemantics | null;
  readonly dependencies: DependencyGraph;
  readonly boundedLoop: BoundedLoop | null;
  readonly externalEffects: readonly string[];
  readonly failureEdges: FailureEdges | null;
  readonly transitionRefusals: Readonly<Record<string, string>>;
  readonly interactionPattern: InteractionPattern | null;
}

export interface WaitRecord {
  readonly resumeEvent: string;
}

export interface FailureProvenance {
  readonly processId: string;
  readonly schemaVersion: string;
  readonly modelKind: string;
  readonly fromState: "running";
  readonly transition: "fail_process";
}

export interface FailureRecord {
  readonly detail: string;
  readonly provenance: FailureProvenance;
  readonly recoveryEdges: readonly RecoveryEdge[];
}

export interface TransitionRecord {
  readonly id: TransitionId;
  readonly from: ProcessState;
  readonly to: ProcessState;
}