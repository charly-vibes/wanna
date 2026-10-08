// Purpose: vocabulary and record shapes for the human-authority layer
// Responsibilities: authority sources, verification bases, risk classes, approval requests/records, material changes, state and transition types
// Rationale: authorization is evaluated at the trusted effect boundary against typed records, never against presentation-shaped data
export const AUTHORITY_SOURCES = [
  "immediate_approval",
  "delegated_authority",
  "bounded_automation_grant",
  "role_policy",
  "organizational_policy",
] as const;

export type AuthoritySource = (typeof AUTHORITY_SOURCES)[number];

export const REQUESTER_KINDS = ["human", "external", "model", "system"] as const;

export type RequesterKind = (typeof REQUESTER_KINDS)[number];

export const VERIFICATION_BASES = [
  "authentication",
  "verification",
  "acknowledgement",
  "recommendation",
  "model_confidence",
] as const;

export type VerificationBasis = (typeof VERIFICATION_BASES)[number];

export const RISK_CLASSES = ["low", "medium", "high", "critical"] as const;

export type RiskClass = (typeof RISK_CLASSES)[number];

export interface ApprovalRequest {
  readonly requestId: string;
  readonly principal: string;
  readonly action: string;
  readonly resourceScope: string;
  readonly riskClass: RiskClass;
  readonly reviewedRevision: string;
  readonly policyVersion: string;
  readonly expiry?: number;
  readonly invalidationConditions?: readonly string[];
  readonly confidence?: number;
  readonly evidenceDigest?: string;
}

export interface AuthorityGrant {
  readonly kind: "grant";
  readonly source: AuthoritySource;
  readonly grantedBy: RequesterKind;
  readonly principal: string;
  readonly action: string;
  readonly resource: string;
  readonly revision: string;
  readonly policyVersion: string;
  readonly maxUses?: number;
  readonly usesRemaining?: number;
}

export interface VerificationClaim {
  readonly kind: "verification";
  readonly basis: VerificationBasis;
  readonly principal?: string;
  readonly confidence?: number;
}

export type AuthorityInput = AuthorityGrant | VerificationClaim;

export interface MaterialChange {
  readonly field: string;
  readonly permitsReuse: boolean;
}

export interface ApprovalRecord {
  readonly requestId: string;
  readonly principal: string;
  readonly action: string;
  readonly resourceScope: string;
  readonly riskClass: RiskClass;
  readonly reviewedRevision: string;
  readonly source: AuthoritySource;
  readonly grantedBy: RequesterKind;
  readonly expiry: number | null;
  readonly invalidationConditions: readonly string[];
}

export type AuditOutcome =
  | "requested"
  | "granted"
  | "denied"
  | "expired"
  | "invalidated"
  | "refused";

export interface AuditRecord {
  readonly outcome: AuditOutcome;
  readonly requestId: string;
  readonly principal: string;
  readonly action: string;
  readonly reason: string | null;
  readonly recordedBy: string;
}

export type HAState =
  | "not_required"
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "invalidated";

export type TransitionId =
  | "request_approval"
  | "grant_approval"
  | "deny_approval"
  | "expire_approval"
  | "invalidate_approval";

export type FireArg =
  | { readonly kind: "authority"; readonly authority: AuthorityInput }
  | { readonly kind: "now"; readonly now: number }
  | { readonly kind: "change"; readonly change: MaterialChange };

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };