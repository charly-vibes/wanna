// Purpose: session-state state machine
// Responsibilities: the five spec transitions (suspend, begin-recovery, resume, detect-conflict, close) with their guards
// Durability and continuity live in plain data; ephemera are kept outside the durable record
import {
  closeReasonExplicit,
  continuityOf,
  concurrentUpdateDetected,
  durableIsSerializable,
  parseRecordedSession,
  pendingInteractionValid,
  resumeValidatesRevisions,
  suspendProbe,
} from "./invariants";
import type { Check } from "./invariants";
import type {
  CloseReason,
  ContinuitySummary,
  PendingInteraction,
  SessionData,
  SessionEnvironment,
  SessionState,
  TransitionId,
  TransitionInput,
  TransitionResult,
  TransitionRow,
} from "./types";
import { SCHEMA_VERSION } from "./types";

export const SESSION_TRANSITIONS: readonly TransitionRow[] = [
  { id: "suspend_session", from: "open", to: "suspended" },
  { id: "begin_recovery", from: "suspended", to: "recovering" },
  { id: "resume_session", from: "recovering", to: "open" },
  { id: "detect_conflict", from: "open", to: "conflicted" },
  { id: "close_session", from: "open", to: "closed" },
];

export interface SessionMachine {
  readonly state: SessionState;
  readonly session: SessionData;
  readonly ephemeral: Readonly<Record<string, unknown>>;
  readonly continuity: ContinuitySummary;
  readonly history: readonly string[];
  fire(id: TransitionId, input?: TransitionInput): TransitionResult;
  recordPending(interaction: PendingInteraction): TransitionResult;
  completeInteraction(interactionId: string): TransitionResult;
  markChanged(itemId: string): TransitionResult;
  markUnresolved(itemId: string): TransitionResult;
  setNextAttention(itemId: string | null): TransitionResult;
  setEphemeral(key: string, value: unknown): void;
  serialize(): string;
  writeWithPrecondition(
    expectedRevision: number,
    apply: (session: SessionData) => SessionData,
  ): TransitionResult;
}

interface Internals {
  state: SessionState;
  session: SessionData;
  staged: SessionData | null;
  stagedRaw: string | null;
  env: SessionEnvironment;
  history: string[];
  ephemeral: Record<string, unknown>;
}

function bump(internals: Internals): void {
  internals.session.revision += 1;
}

function recordTransition(internals: Internals, id: TransitionId): void {
  const row = SESSION_TRANSITIONS.find((r) => r.id === id);
  internals.history.push(`${id} ${row?.from}->${row?.to}`);
}

function notClosed(internals: Internals): Check {
  return internals.state === "closed"
    ? { ok: false, reason: "session is closed and no longer accepts updates" }
    : { ok: true };
}

function guardSuspend(internals: Internals, input: TransitionInput): TransitionResult {
  return durableIsSerializable(suspendProbe(internals.session, input));
}

function resumeRaw(internals: Internals, input: TransitionInput): string | null {
  if (input.serialized !== undefined) return input.serialized;
  return internals.stagedRaw;
}

function guardResume(internals: Internals, input: TransitionInput): TransitionResult {
  const raw = resumeRaw(internals, input);
  if (raw === null) {
    return {
      ok: false,
      reason: "resume_validates_revisions does not hold: no staged record from begin_recovery",
    };
  }
  return resumeValidatesRevisions(raw, internals.env);
}

function guardDetect(internals: Internals, input: TransitionInput): TransitionResult {
  const base = input.baseRevision;
  if (typeof base !== "number") {
    return {
      ok: false,
      reason: "concurrent_updates_detected does not hold: a base revision is required to detect a concurrent update",
    };
  }
  const check = concurrentUpdateDetected(base, internals.session);
  return check.ok ? { ok: true } : check;
}

function checkGuard(
  internals: Internals,
  id: TransitionId,
  input: TransitionInput,
): TransitionResult {
  if (id === "suspend_session") return guardSuspend(internals, input);
  if (id === "begin_recovery" || id === "resume_session") return guardResume(internals, input);
  if (id === "detect_conflict") return guardDetect(internals, input);
  return closeReasonExplicit(input.reason);
}

function adoptRecorded(internals: Internals): void {
  const staged = internals.staged;
  if (staged === null) return;
  const adoptedRevision = Math.max(staged.revision, internals.session.revision);
  internals.session = { ...staged, revision: adoptedRevision };
  internals.staged = null;
  internals.stagedRaw = null;
}

function applyEffect(
  internals: Internals,
  id: TransitionId,
  input: TransitionInput,
): void {
  recordTransition(internals, id);
  if (id === "suspend_session") {
    internals.state = "suspended";
  } else if (id === "begin_recovery") {
    internals.staged = parseRecordedSession(input.serialized as string);
    // undefined serialized is equivalent to null for stagedRaw consumers (resumeRaw treats both as absent)
    internals.stagedRaw = input.serialized ?? null;
    internals.state = "recovering";
  } else if (id === "resume_session") {
    if (input.serialized !== undefined) {
      internals.staged = parseRecordedSession(input.serialized);
    }
    adoptRecorded(internals);
    internals.state = "open";
  } else if (id === "detect_conflict") {
    internals.state = "conflicted";
  } else {
    internals.session.closeReason = input.reason as CloseReason;
    internals.state = "closed";
  }
  bump(internals);
}

function fireTransition(
  internals: Internals,
  id: TransitionId,
  input: TransitionInput,
): TransitionResult {
  const row = SESSION_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = checkGuard(internals, id, input);
  if (!guard.ok) return guard;
  applyEffect(internals, id, input);
  return { ok: true };
}

function pushItem(list: string[], itemId: string, label: string): TransitionResult {
  if (typeof itemId !== "string" || itemId.length === 0) {
    return { ok: false, reason: `${label} requires a non-empty item id` };
  }
  if (!list.includes(itemId)) list.push(itemId);
  return { ok: true };
}

function completeOne(internals: Internals, interactionId: string): TransitionResult {
  const closed = notClosed(internals);
  if (!closed.ok) return closed;
  if (internals.session.pending[interactionId] === undefined) {
    return { ok: false, reason: `interaction ${interactionId} is not pending` };
  }
  delete internals.session.pending[interactionId];
  internals.session.completed.push(interactionId);
  bump(internals);
  return { ok: true };
}

function replaceWithPrecondition(
  internals: Internals,
  expectedRevision: number,
  apply: (session: SessionData) => SessionData,
): TransitionResult {
  const closed = notClosed(internals);
  if (!closed.ok) return closed;
  if (expectedRevision !== internals.session.revision) {
    return {
      ok: false,
      reason: `concurrent update detected: expected revision ${expectedRevision} but session is at ${internals.session.revision}`,
    };
  }
  const next = apply(structuredClone(internals.session));
  if (next === null || typeof next !== "object" || next.sessionId !== internals.session.sessionId) {
    return {
      ok: false,
      reason: "concurrent update rejected: replacement must keep the stable session id",
    };
  }
  internals.session = next;
  bump(internals);
  return { ok: true };
}

function makeMutators(internals: Internals) {
  return {
    recordPending: (interaction: PendingInteraction): TransitionResult => {
      const closed = notClosed(internals);
      if (!closed.ok) return closed;
      const check = pendingInteractionValid(internals.session, interaction);
      if (!check.ok) return check;
      internals.session.pending[interaction.interactionId] = { ...interaction };
      bump(internals);
      return { ok: true };
    },
    completeInteraction: (interactionId: string): TransitionResult =>
      completeOne(internals, interactionId),
    markChanged: (itemId: string): TransitionResult => {
      const closed = notClosed(internals);
      if (!closed.ok) return closed;
      const r = pushItem(internals.session.changed, itemId, "markChanged");
      if (r.ok) bump(internals);
      return r;
    },
    markUnresolved: (itemId: string): TransitionResult => {
      const closed = notClosed(internals);
      if (!closed.ok) return closed;
      const r = pushItem(internals.session.unresolved, itemId, "markUnresolved");
      if (r.ok) bump(internals);
      return r;
    },
    setNextAttention: (itemId: string | null): TransitionResult => {
      const closed = notClosed(internals);
      if (!closed.ok) return closed;
      internals.session.nextAttention = itemId;
      bump(internals);
      return { ok: true };
    },
  };
}

function serializeSession(internals: Internals): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    policyVersion: internals.env.policyVersion,
    ...internals.session,
  });
}

function initialSession(sessionId: string): SessionData {
  return {
    sessionId,
    revision: 1,
    pending: {},
    completed: [],
    changed: [],
    unresolved: [],
    nextAttention: null,
    closeReason: null,
  };
}

function makeInternals(sessionId: string, env: SessionEnvironment): Internals {
  return {
    state: "open",
    session: initialSession(sessionId),
    staged: null,
    stagedRaw: null,
    env,
    history: [],
    ephemeral: {},
  };
}

function makeMachine(internals: Internals): SessionMachine {
  const mutators = makeMutators(internals);
  return {
    get state() {
      return internals.state;
    },
    get session() {
      return internals.session;
    },
    get ephemeral() {
      return internals.ephemeral;
    },
    get continuity() {
      return continuityOf(internals.session);
    },
    get history() {
      return internals.history;
    },
    fire: (id, input) => fireTransition(internals, id, input ?? {}),
    ...mutators,
    setEphemeral: (key, value) => {
      internals.ephemeral[key] = value;
    },
    serialize: () => serializeSession(internals),
    writeWithPrecondition: (expectedRevision, apply) =>
      replaceWithPrecondition(internals, expectedRevision, apply),
  };
}

export function createSession(
  sessionId: string,
  env: SessionEnvironment,
): SessionMachine {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("session identity requires a non-empty session id");
  }
  return makeMachine(makeInternals(sessionId, env));
}
