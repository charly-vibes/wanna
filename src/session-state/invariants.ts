// Purpose: invariants and guards for the session-state machine
// Responsibilities: serializability, resume revalidation, conflict detection, explicit close, pending indexing
// Rationale: each guard returns a precise failure reason so negative tests can assert it
import type {
  CloseReason,
  PendingInteraction,
  SessionData,
  SessionEnvironment,
  TransitionInput,
} from "./types";
import { CLOSE_REASONS, SCHEMA_VERSION } from "./types";

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

const HOST_TOKENS = [
  "ui", "dom", "widget", "node", "handle", "focus", "scroll", "cursor",
  "panel", "closure", "modal", "button",
] as const;

function walk(value: unknown, path: string, problems: string[]): void {
  if (typeof value === "function") {
    problems.push(
      `session_serializable does not hold: durable state contains a function or closure at ${path}`,
    );
    return;
  }
  if (value === undefined) {
    problems.push(
      `session_serializable does not hold: durable state contains undefined at ${path}`,
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, problems));
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    const child = path === "root" ? `root.${key}` : `${path}.${key}`;
    if (HOST_TOKENS.some((token) => key.toLowerCase().includes(token))) {
      problems.push(
        `session_serializable does not hold: durable state contains host/presentation state at ${child}`,
      );
      continue;
    }
    walk(v, child, problems);
  }
}

export function durableIsSerializable(value: unknown): Check {
  const problems: string[] = [];
  walk(value, "root", problems);
  if (problems.length === 0) return { ok: true };
  // invariant: a non-empty problem list always has a first entry
  return { ok: false, reason: problems[0]! };
}

function pendingEntryValid(id: string, entry: unknown, env: SessionEnvironment): Check {
  const pending = entry as { taskRevision?: unknown; contractRevision?: unknown };
  if (typeof pending?.taskRevision !== "string" || pending.taskRevision.length === 0) {
    return {
      ok: false,
      reason: `resume_validates_revisions does not hold: interaction ${id} is missing its task revision`,
    };
  }
  const compatible = (env.supportedContractRevisions as readonly unknown[]).includes(
    pending.contractRevision,
  );
  if (!compatible) {
    return {
      ok: false,
      reason: `resume_validates_revisions does not hold: interaction ${id} contract revision ${String(pending.contractRevision)} is not compatible`,
    };
  }
  return { ok: true };
}

function recordIdentityValid(record: Record<string, unknown>): boolean {
  const revision = record.revision;
  return (
    typeof record.sessionId === "string" &&
    record.sessionId.length > 0 &&
    typeof revision === "number" &&
    Number.isInteger(revision) &&
    revision >= 1
  );
}

function recordedPendingValid(
  record: Record<string, unknown>,
  env: SessionEnvironment,
): Check {
  const pending = record.pending;
  if (pending === undefined || pending === null || typeof pending !== "object" || Array.isArray(pending)) {
    return { ok: true };
  }
  for (const [id, entry] of Object.entries(pending as Record<string, unknown>)) {
    const check = pendingEntryValid(id, entry, env);
    if (!check.ok) return check;
  }
  return { ok: true };
}

function recordedRecordValid(value: unknown, env: SessionEnvironment): Check {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "resume_validates_revisions does not hold: recorded session identity is invalid" };
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `resume_validates_revisions does not hold: schema version mismatch (recorded ${String(record.schemaVersion)}, expected ${SCHEMA_VERSION})`,
    };
  }
  if (record.policyVersion !== env.policyVersion) {
    return {
      ok: false,
      reason: `resume_validates_revisions does not hold: policy version mismatch (recorded ${String(record.policyVersion)}, expected ${env.policyVersion})`,
    };
  }
  if (!recordIdentityValid(record)) {
    return {
      ok: false,
      reason: "resume_validates_revisions does not hold: recorded session identity is invalid",
    };
  }
  return recordedPendingValid(record, env);
}

export function resumeValidatesRevisions(raw: string, env: SessionEnvironment): Check {
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: "resume_validates_revisions does not hold: serialized session is not valid JSON",
    };
  }
  return recordedRecordValid(record, env);
}

export function parseRecordedSession(raw: string): SessionData {
  const record = JSON.parse(raw) as Record<string, unknown>;
  const pending = record.pending;
  return {
    sessionId: record.sessionId as string,
    revision: record.revision as number,
    pending:
      pending !== null && typeof pending === "object" && !Array.isArray(pending)
        ? { ...(pending as Record<string, PendingInteraction>) }
        : {},
    completed: Array.isArray(record.completed) ? [...(record.completed as string[])] : [],
    changed: Array.isArray(record.changed) ? [...(record.changed as string[])] : [],
    unresolved: Array.isArray(record.unresolved) ? [...(record.unresolved as string[])] : [],
    nextAttention:
      typeof record.nextAttention === "string" ? (record.nextAttention as string) : null,
    closeReason: null,
  };
}

export function concurrentUpdateDetected(baseRevision: number, session: SessionData): Check {
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision)) {
    return {
      ok: false,
      reason: "concurrent_updates_detected does not hold: a base revision is required to detect a concurrent update",
    };
  }
  if (baseRevision === session.revision) {
    return {
      ok: false,
      reason: `concurrent_updates_detected does not hold: revision precondition satisfied (base ${baseRevision} equals current ${session.revision}) — no concurrent update to resolve`,
    };
  }
  return { ok: true };
}

export function closeReasonExplicit(reason: CloseReason | undefined): Check {
  if (reason === undefined || !(CLOSE_REASONS as readonly string[]).includes(reason)) {
    return {
      ok: false,
      reason: `session_close_explicit does not hold: closing requires an explicit reason (completed, cancelled, or admin_recovery), got ${String(reason)}`,
    };
  }
  return { ok: true };
}

export function pendingInteractionValid(
  session: SessionData,
  interaction: PendingInteraction,
): Check {
  if (typeof interaction.interactionId !== "string" || interaction.interactionId.length === 0) {
    return { ok: false, reason: "pending interaction requires a stable interaction id" };
  }
  const id = interaction.interactionId;
  if (typeof interaction.taskRevision !== "string" || interaction.taskRevision.length === 0) {
    return { ok: false, reason: `pending interaction ${id} requires its task revision` };
  }
  if (typeof interaction.contractRevision !== "string" || interaction.contractRevision.length === 0) {
    return { ok: false, reason: `pending interaction ${id} requires its contract revision` };
  }
  if (session.pending[id] !== undefined) {
    return { ok: false, reason: `pending interaction ${id} already exists` };
  }
  return { ok: true };
}

export function continuityOf(session: SessionData) {
  return {
    completed: [...session.completed],
    pending: Object.keys(session.pending),
    changed: [...session.changed],
    unresolved: [...session.unresolved],
    nextAttention: session.nextAttention,
  };
}

export function suspendProbe(internalsSession: SessionData, input: TransitionInput): unknown {
  return input.snapshot !== undefined
    ? { session: internalsSession, snapshot: input.snapshot }
    : { session: internalsSession };
}
