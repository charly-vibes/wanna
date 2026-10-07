// Purpose: vocabulary and record shapes for the session-state layer
// Responsibilities: states, transitions, pending interactions, serialized records, continuity summary
// Rationale: durable session state is plain data — no functions, closures, UI nodes, or host handles
export const SCHEMA_VERSION = "session-state-1";

export type SessionState =
  | "open"
  | "suspended"
  | "recovering"
  | "closed"
  | "conflicted";

export type TransitionId =
  | "suspend_session"
  | "begin_recovery"
  | "resume_session"
  | "detect_conflict"
  | "close_session";

export const CLOSE_REASONS = ["completed", "cancelled", "admin_recovery"] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

export interface PendingInteraction {
  readonly interactionId: string;
  readonly taskRevision: string;
  readonly contractRevision: string;
}

export interface SessionData {
  sessionId: string;
  revision: number;
  pending: Record<string, PendingInteraction>;
  completed: string[];
  changed: string[];
  unresolved: string[];
  nextAttention: string | null;
  closeReason: CloseReason | null;
}

export interface SessionEnvironment {
  readonly policyVersion: string;
  readonly supportedContractRevisions: readonly string[];
}

export interface ContinuitySummary {
  readonly completed: readonly string[];
  readonly pending: readonly string[];
  readonly changed: readonly string[];
  readonly unresolved: readonly string[];
  readonly nextAttention: string | null;
}

export interface TransitionInput {
  readonly snapshot?: unknown;
  readonly serialized?: string;
  readonly baseRevision?: number;
  readonly reason?: CloseReason;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: SessionState;
  readonly to: SessionState;
}
