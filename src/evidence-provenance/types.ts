// Purpose: vocabulary and record shapes for the evidence and provenance layer
// Responsibilities: evidence classes, normative strengths, explicit statuses, record shapes, audit entries, states and transition ids
// Rationale: provenance supports explanation and audit — it never implies an input source is true or that approval proves correctness
export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

export const EVIDENCE_CLASSES = [
  "normative_standard",
  "empirical_evidence",
  "established_guidance",
  "architectural_synthesis",
  "design_hypothesis",
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const NORMATIVE_STRENGTHS = ["normative", "non_normative", "unknown"] as const;
export type NormativeStrength = (typeof NORMATIVE_STRENGTHS)[number];

export const EXPLICIT_EVIDENCE_STATUSES = [
  "verified",
  "missing",
  "conflicting",
  "stale",
  "unverifiable",
] as const;
export type EvidenceStatus = (typeof EXPLICIT_EVIDENCE_STATUSES)[number];

export interface EvidenceProposal {
  readonly id?: string;
  readonly evidenceKind?: string;
  readonly sourceRef?: string;
  readonly timestamp?: string;
  readonly sequence?: number;
  readonly schemaVersion?: string;
  readonly inputEvidenceRefs?: readonly string[];
  readonly transformationRevision?: string;
  readonly status?: string;
  readonly sensitiveFields?: readonly string[];
}

export interface ModelProposalRecord {
  readonly modelProvider?: string;
  readonly promptRevision?: string;
  readonly proposalId?: string;
  readonly promptText?: string;
}

export interface ReviewRecord {
  readonly reviewedRevision?: string;
  readonly action?: string;
  readonly reviewScope?: string;
  readonly provesTruth?: boolean;
}

export interface ImportedClaim {
  readonly claimId: string;
  readonly sourceRef: string;
  readonly evidenceClass?: EvidenceClass;
  readonly normativeStrength?: NormativeStrength;
  readonly standardRef?: string;
}

export interface RedactionPolicy {
  readonly redactedFields: readonly string[];
  readonly accessRestrictedFields: readonly string[];
}

export type EvidenceState =
  | "proposed"
  | "validated"
  | "committed"
  | "superseded"
  | "restricted";

export type TransitionId =
  | "validate_evidence"
  | "commit_evidence"
  | "supersede_evidence"
  | "restrict_sensitive_evidence";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export interface AppliedTransition {
  readonly id: TransitionId;
  readonly from: EvidenceState;
  readonly to: EvidenceState;
}

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: EvidenceState;
  readonly to: EvidenceState;
}

export const EVIDENCE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_evidence", from: "proposed", to: "validated" },
  { id: "commit_evidence", from: "validated", to: "committed" },
  { id: "supersede_evidence", from: "committed", to: "superseded" },
  { id: "restrict_sensitive_evidence", from: "committed", to: "restricted" },
];

export interface AuditEntry {
  readonly seq: number;
  readonly transition: TransitionId;
  readonly recordId: string;
  readonly replaces?: string;
}

export type FireArg =
  | { readonly kind: "correction"; readonly correctionId: string }
  | { readonly kind: "policy"; readonly policy: RedactionPolicy };
