// Purpose: vocabulary and record shapes for the interaction-primitives gate
// Responsibilities: semantic layer vocabulary, revision records, state and transition types
// Rationale: each semantic layer is a distinct, independently versioned model — the gate validates separation, never collapse
export const SEMANTIC_LAYERS = [
  "need", "contribution", "pattern", "interaction", "presentation",
  "process", "authority", "evidence", "failure", "recovery", "continuity",
] as const;

export type SemanticLayer = (typeof SEMANTIC_LAYERS)[number];

export const EVIDENCE_CLASSES = [
  "normative_standard",
  "empirical_evidence",
  "design_guidance",
  "architectural_synthesis",
  "design_hypothesis",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export interface LayerDeclaration {
  readonly layer: SemanticLayer;
  readonly typeToken: string;
  readonly updateRule: string;
}

export type ContractKind = "interaction" | "presentation" | "workflow" | "capability";
export type ContractForm = "declarative-data" | "executable-code";

export interface ContractDeclaration {
  readonly contractId: string;
  readonly kind: ContractKind;
  readonly form: ContractForm;
  readonly executableRef?: string;
}

export interface ProvenanceRecord {
  readonly claimId: string;
  readonly evidenceClass?: EvidenceClass;
}

export type EffectCertainty = "durable" | "at_most_once" | "at_least_once" | "uncertain";

export type RecoveryAction =
  | "retry" | "resume" | "reconcile" | "restore" | "rollback" | "compensate" | "escalate";

export interface FailurePath {
  readonly operation: string;
  readonly failureType: string;
  readonly effectCertainty: EffectCertainty;
  readonly recovery: RecoveryAction;
  readonly recoveryPreconditions: readonly string[];
}

export type AuthoritySource =
  | "policy" | "grant" | "confidence" | "recommendation" | "verification"
  | "acknowledgement" | "ui_render" | "generic_click";

export interface AuthorityGrant {
  readonly grantId: string;
  readonly effect: string;
  readonly source: AuthoritySource;
}

export interface InteractionSelection {
  readonly selectionId: string;
  readonly needRef?: string;
  readonly contributionRef?: string;
  readonly patternRef?: string;
  readonly presentationRef?: string;
}

export interface ContinuityRecord {
  readonly checkpointId: string;
  readonly stateDigest: string;
  readonly reorientation?: string;
  readonly reconciliation?: string;
}

export interface PrimitiveRevision {
  readonly revisionId: string;
  readonly layers: readonly LayerDeclaration[];
  readonly mutatingOperations: readonly string[];
  readonly failurePaths: readonly FailurePath[];
  readonly contracts: readonly ContractDeclaration[];
  readonly provenance: readonly ProvenanceRecord[];
  readonly authorityGrants: readonly AuthorityGrant[];
  readonly selections: readonly InteractionSelection[];
  readonly continuityRecords: readonly ContinuityRecord[];
}

export type PrimitiveState =
  | "draft" | "validated" | "active" | "rejected" | "retired";

export type PrimitiveTransitionId =
  | "validate_system_primitives"
  | "reject_collapsed_model"
  | "activate_valid_model"
  | "retire_model_revision";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };