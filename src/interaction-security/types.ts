// Purpose: vocabulary and record shapes for the interaction-security boundary
// Responsibilities: states, transitions, lifecycle events, untrusted agent payload, trusted policy/catalog/ownership, validated interaction
// Rationale: agent payloads are untrusted data; policy, catalog, and ownership context are trusted host inputs
export type SecurityState = "untrusted" | "validated" | "rejected" | "retired";

export type TransitionId =
  | "accept_validated_payload"
  | "reject_untrusted_payload"
  | "resubmit_after_rejection"
  | "retire_after_use";

export const LIFECYCLE_EVENTS = ["consume", "cancel", "supersede", "expire"] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

export interface AgentPayload {
  readonly kind: string;
  readonly label: string;
  readonly description?: string;
  readonly options?: readonly string[];
  readonly url?: string;
  readonly component?: string;
  readonly data?: unknown;
  // forged authorization claims — carried as untrusted data, never consulted by the gate
  readonly authorized?: boolean;
  readonly approvedBy?: string;
  readonly permissions?: readonly string[];
  // ownership claims, verified against trusted context
  readonly taskRevision: string;
  readonly sessionId: string;
  readonly interactionId: string;
  readonly revision: number;
}

export interface ComponentMapping {
  readonly kind: string;
  readonly component: string;
}

export interface SecurityPolicy {
  readonly maxPayloadBytes: number;
  readonly maxOptionCount: number;
  readonly maxNestingDepth: number;
  readonly maxFieldLength: number;
  readonly allowedUrlSchemes: readonly string[];
  readonly allowedUrlHosts: readonly string[];
  readonly secretMarkers: readonly string[];
  readonly maxDiagnosticChars: number;
}

export interface TrustedOwnership {
  readonly taskRevision: string;
  readonly sessionId: string;
  readonly interactionId: string;
  readonly currentRevision: number;
}

export interface ValidatedInteraction {
  readonly kind: string;
  readonly component: string;
  readonly label: string;
  readonly description?: string;
  readonly options?: readonly string[];
  readonly url?: string;
  readonly taskRevision: string;
  readonly sessionId: string;
  readonly interactionId: string;
  readonly revision: number;
  readonly validatedBy: string;
}

export interface Check {
  readonly ok: boolean;
  readonly code?: string;
  readonly reason?: string;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: SecurityState;
  readonly to: SecurityState;
}

export interface TransitionRecord {
  readonly id: TransitionId;
  readonly from: SecurityState;
  readonly to: SecurityState;
}
