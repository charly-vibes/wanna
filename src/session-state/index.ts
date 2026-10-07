// Purpose: public surface of the session-state layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createSession, SESSION_TRANSITIONS } from "./machine";
export type { SessionMachine } from "./machine";
export {
  closeReasonExplicit,
  continuityOf,
  concurrentUpdateDetected,
  durableIsSerializable,
  pendingInteractionValid,
  resumeValidatesRevisions,
} from "./invariants";
export type { Check } from "./invariants";
export {
  CLOSE_REASONS,
  SCHEMA_VERSION,
} from "./types";
export type {
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
