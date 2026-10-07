// Purpose: contribution-primitive state machine
// Responsibilities: the six transitions (validate, reject, activate, complete, escape, retire) with their guards
// Rationale: guards run before any state mutation — a malformed event never reaches the reducer
import type {
  EscapeOutcome,
  EscapeRecord,
  PrimitiveEvent,
  PrimitiveProposal,
  PrimitiveState,
  TransitionArg,
  TransitionId,
  TransitionResult,
} from "./types";
import { ESCAPE_EFFECTS } from "./types";
import {
  escapeSemanticsExplicit,
  primitiveEventTyped,
  rejectInvalidPrimitive,
  semanticallyAtomic,
  taxonomyVersionedRetirement,
} from "./invariants";

export const MACHINE_VERSION = "contribution-primitives-machine@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: PrimitiveState;
  readonly to: PrimitiveState;
}

export const PRIMITIVE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_primitive", from: "proposed", to: "validated" },
  { id: "reject_invalid_primitive", from: "proposed", to: "invalid" },
  { id: "activate_primitive", from: "validated", to: "active" },
  { id: "complete_primitive", from: "active", to: "completed" },
  { id: "escape_primitive", from: "active", to: "escaped" },
  { id: "retire_primitive", from: "completed", to: "retired" },
];

export interface PrimitiveMachine {
  readonly proposal: PrimitiveProposal;
  readonly state: PrimitiveState;
  readonly event: PrimitiveEvent | null;
  readonly escapeRecord: EscapeRecord | null;
  readonly invalidReason: string | null;
  fire(id: TransitionId, arg?: TransitionArg): TransitionResult;
}

interface Internals {
  state: PrimitiveState;
  proposal: PrimitiveProposal;
  event: PrimitiveEvent | null;
  escapeRecord: EscapeRecord | null;
  invalidReason: string | null;
}

function buildEvent(proposal: PrimitiveProposal): PrimitiveEvent {
  return {
    kind: proposal.kind as PrimitiveEvent["kind"],
    taxonomyVersion: "primitive-taxonomy-2026.10-provisional",
    interactionId: proposal.interactionId,
    taskRevision: proposal.taskRevision,
    payload: proposal.responsePayload,
    provenance: [...proposal.provenance],
    emittedBy: MACHINE_VERSION,
  };
}

type GuardFn = (proposal: PrimitiveProposal, arg: TransitionArg | undefined) => TransitionResult;

const GUARDS: Readonly<Record<TransitionId, GuardFn>> = {
  validate_primitive: (proposal) => {
    const check = semanticallyAtomic(proposal.kind);
    return check.ok ? { ok: true } : check;
  },
  reject_invalid_primitive: (proposal) => rejectInvalidPrimitive(proposal.kind),
  activate_primitive: (proposal) => {
    const check = primitiveEventTyped(proposal, false);
    return check.ok ? { ok: true } : { ok: false, reason: `guard primitive_event_typed does not hold: ${check.reason}` };
  },
  complete_primitive: (proposal) => {
    const check = primitiveEventTyped(proposal, true);
    return check.ok ? { ok: true } : { ok: false, reason: `guard primitive_event_typed does not hold: ${check.reason}` };
  },
  escape_primitive: (proposal, arg) => escapeSemanticsExplicit(proposal, arg?.escapeOutcome),
  retire_primitive: (_proposal, arg) => taxonomyVersionedRetirement(arg?.taxonomyRevision),
};

function guardHolds(id: TransitionId, proposal: PrimitiveProposal, arg: TransitionArg | undefined): TransitionResult {
  return GUARDS[id](proposal, arg);
}

function applyEffect(
  internals: Internals,
  id: TransitionId,
  arg: TransitionArg | undefined,
): void {
  if (id === "validate_primitive") {
    internals.state = "validated";
    return;
  }
  if (id === "reject_invalid_primitive") {
    internals.state = "invalid";
    const atomic = semanticallyAtomic(internals.proposal.kind);
    internals.invalidReason = atomic.ok ? "invalid primitive" : atomic.reason;
    return;
  }
  if (id === "activate_primitive") {
    internals.state = "active";
    return;
  }
  if (id === "complete_primitive") {
    internals.state = "completed";
    internals.event = buildEvent(internals.proposal);
    return;
  }
  if (id === "escape_primitive") {
    const outcome = arg?.escapeOutcome as EscapeOutcome;
    const declaration = internals.proposal.escapeDeclaration;
    internals.state = "escaped";
    internals.escapeRecord = {
      kind: internals.proposal.kind,
      outcome,
      workflowEffect: declaration?.[outcome] ?? ESCAPE_EFFECTS[outcome],
      responsePayload: undefined,
    };
    return;
  }
  internals.state = "retired";
}

function fireTransition(
  internals: Internals,
  id: TransitionId,
  arg: TransitionArg | undefined,
): TransitionResult {
  const row = PRIMITIVE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(id, internals.proposal, arg);
  if (!guard.ok) return guard;
  applyEffect(internals, id, arg);
  return { ok: true };
}

function makeMachine(internals: Internals): PrimitiveMachine {
  return {
    get proposal() {
      return internals.proposal;
    },
    get state() {
      return internals.state;
    },
    get event() {
      return internals.event;
    },
    get escapeRecord() {
      return internals.escapeRecord;
    },
    get invalidReason() {
      return internals.invalidReason;
    },
    fire: (id, arg) => fireTransition(internals, id, arg),
  };
}

export function createPrimitiveMachine(proposal: PrimitiveProposal): PrimitiveMachine {
  const internals: Internals = {
    state: "proposed",
    proposal,
    event: null,
    escapeRecord: null,
    invalidReason: null,
  };
  return makeMachine(internals);
}