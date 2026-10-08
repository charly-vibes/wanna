// Purpose: interaction-primitives state machine
// Responsibilities: the four declared transitions (validate, reject-collapsed, activate, retire) with their guards
// Rationale: the gate mirrors the spec Model table row for row and refuses imprecise failures — every guard violation names its row
import type {
  PrimitiveRevision,
  PrimitiveState,
  PrimitiveTransitionId,
  TransitionResult,
} from "./types";
import {
  contractsDeclarative,
  evidenceStrengthExplicit,
  semanticLayersSeparated,
} from "./invariants";

export interface TransitionRow {
  readonly id: PrimitiveTransitionId;
  readonly from: PrimitiveState;
  readonly to: PrimitiveState;
}

export const PRIMITIVE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_system_primitives", from: "draft", to: "validated" },
  { id: "reject_collapsed_model", from: "draft", to: "rejected" },
  { id: "activate_valid_model", from: "validated", to: "active" },
  { id: "retire_model_revision", from: "active", to: "retired" },
];

export interface PrimitiveSystemGate {
  readonly revision: PrimitiveRevision;
  readonly state: PrimitiveState;
  readonly rejectionReason: string | null;
  fire(id: PrimitiveTransitionId): TransitionResult;
}

interface Internals {
  state: PrimitiveState;
  revision: PrimitiveRevision;
  rejectionReason: string | null;
}

function guardHolds(id: PrimitiveTransitionId, revision: PrimitiveRevision): TransitionResult {
  if (id === "validate_system_primitives") return semanticLayersSeparated(revision);
  if (id === "reject_collapsed_model") {
    const separated = semanticLayersSeparated(revision);
    return separated.ok
      ? { ok: false, reason: "reject_collapsed_model requires a collapsed model — semantic_layers_separated holds" }
      : { ok: true };
  }
  if (id === "activate_valid_model") return contractsDeclarative(revision);
  return evidenceStrengthExplicit(revision);
}

function applyEffect(internals: Internals, id: PrimitiveTransitionId): void {
  const row = PRIMITIVE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return;
  internals.state = row.to;
  if (id === "reject_collapsed_model") {
    internals.rejectionReason = semanticLayersSeparated(internals.revision).reason ?? "collapsed model";
  }
}

function fireTransition(internals: Internals, id: PrimitiveTransitionId): TransitionResult {
  const row = PRIMITIVE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(id, internals.revision);
  if (!guard.ok) return guard;
  applyEffect(internals, id);
  return { ok: true };
}

function makeGate(internals: Internals): PrimitiveSystemGate {
  return {
    get revision() {
      return internals.revision;
    },
    get state() {
      return internals.state;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    fire: (id) => fireTransition(internals, id),
  };
}

export function createPrimitiveSystemGate(revision: PrimitiveRevision): PrimitiveSystemGate {
  const internals: Internals = { state: "draft", revision, rejectionReason: null };
  return makeGate(internals);
}