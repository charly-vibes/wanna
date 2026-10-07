// Purpose: vocabulary and record shapes for the interaction-need layer
// Responsibilities: need kinds, taxonomy version, proposal/normalized/unresolved records, state and transition types
// Rationale: normalization works on typed records, never on presentation-shaped data
export const TAXONOMY_VERSION = "need-taxonomy-2026.10-provisional";

export const NEED_KINDS = [
  "acknowledge", "annotate", "approve", "authorize", "choose", "classify",
  "clarify_intent", "confirm", "correct", "create", "delegate", "escalate",
  "inspect", "provide_evidence", "reject", "review_artifact",
] as const;

export type NeedKind = (typeof NEED_KINDS)[number];

export type EvidenceStrength =
  | "missing"
  | "contradictory"
  | "ambiguous"
  | "weak"
  | "sufficient";

export interface NeedProposal {
  readonly kind?: string;
  readonly target?: string | readonly string[];
  readonly taskRevision: string;
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly evidenceStrength: EvidenceStrength;
  readonly confidence?: number;
}

export interface NormalizedNeed {
  readonly kind: NeedKind;
  readonly taxonomyVersion: string;
  readonly target: string;
  readonly taskRevision: string;
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly normalizedBy: string;
  readonly advisoryConfidence?: number;
}

export interface UnresolvedNeed {
  readonly kind?: string;
  readonly target?: string | readonly string[];
  readonly taskRevision: string;
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly reason: string;
}

export type NeedState =
  | "proposed"
  | "validating"
  | "normalized"
  | "unresolved"
  | "rejected";

export type TransitionId =
  | "validate_need"
  | "reject_invalid_need"
  | "normalize_need"
  | "preserve_unresolved_need"
  | "retry_unresolved";

export type TransitionResult = { ok: true } | { ok: false; reason: string };
