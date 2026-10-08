// Purpose: vocabulary and record shapes for the capability-lifecycle layer
// Responsibilities: lifecycle states, transition ids, proposal/preview/evaluation/gate/composition records, policy paths
// Rationale: the lifecycle works on typed records; composition of trusted operations is the preferred implementation
export type LifecycleState =
  | "proposed"
  | "inspected"
  | "previewed"
  | "evaluated"
  | "approved"
  | "registered"
  | "rejected"
  | "retired";

export type LifecycleTransitionId =
  | "inspect_candidate"
  | "preview_candidate"
  | "evaluate_candidate"
  | "approve_candidate"
  | "register_candidate"
  | "reject_candidate"
  | "retire_capability";

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type TransitionResult = Check;

export type RiskClass = "low" | "standard" | "high";

export type GateOutcome = "passed" | "failed" | "not_run";

export interface GateResult {
  readonly gate: string;
  readonly outcome: GateOutcome;
}

export interface PreviewContext {
  readonly isolated: boolean;
  readonly reversible: boolean;
}

export interface EvaluationPlan {
  readonly goalChecks: readonly string[];
  readonly safetyInvariants: readonly string[];
}

export interface CompositionStep {
  readonly id: string;
  readonly capabilityId: string;
  readonly dependsOn: readonly string[];
  readonly inputType: string;
  readonly outputType: string;
  readonly cost: number;
}

export interface CapabilityComposition {
  readonly steps: readonly CompositionStep[];
  readonly executionBudget: number;
}

export interface CapabilityProposal {
  readonly capabilityId: string;
  readonly revision: string;
  readonly behavior: string;
  readonly dependencies: readonly string[];
  readonly effectDeclarations: readonly string[];
  readonly tests: readonly string[];
  readonly provenance: string;
  readonly preview: PreviewContext;
  readonly evaluation: EvaluationPlan;
  readonly riskClass: RiskClass;
  readonly gateResults: readonly GateResult[];
  readonly composition?: CapabilityComposition;
}

export interface InvokeRequest {
  readonly capabilityId: string;
  readonly policyPath: string;
}

export interface AuditEntry {
  readonly transition: string;
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly revision: string;
}

export const INVOKE_POLICY = "capability-invoke-policy";

export const DEVELOPMENT_POLICY = "capability-development-policy";

export const RISK_CLASSES: readonly RiskClass[] = ["low", "standard", "high"];

export const REQUIRED_GATES: Record<RiskClass, readonly string[]> = {
  low: ["conformance"],
  standard: ["conformance", "safety"],
  high: ["conformance", "safety", "human_approval"],
};
