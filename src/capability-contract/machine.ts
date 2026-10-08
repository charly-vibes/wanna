// Purpose: capability-contract state machine
// Responsibilities: the four transitions (validate, reject, register, deprecate) with their guards
// Rationale: model-generated capability proposals are untrusted until validated and committed; rejection is explicit, never silent
import type {
  CapabilityContract,
  CapabilityState,
  CapabilityTransitionId,
  Check,
  CompatibilityDecision,
  TransitionPayloadMap,
  TransitionResult,
} from "./types";
import {
  compatibilityExplicit,
  evaluationContractDeclared,
  inputsOutputsTyped,
} from "./invariants";

export interface TransitionRow {
  readonly id: CapabilityTransitionId;
  readonly from: CapabilityState;
  readonly to: CapabilityState;
}

export const CAPABILITY_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_capability", from: "proposed", to: "validated" },
  { id: "reject_capability", from: "proposed", to: "rejected" },
  { id: "register_capability", from: "validated", to: "registered" },
  { id: "deprecate_capability", from: "registered", to: "deprecated" },
];

export interface CapabilityMachine {
  readonly capability: CapabilityContract;
  readonly state: CapabilityState;
  readonly compatibility: CompatibilityDecision | null;
  readonly rejectionReason: string | null;
  readonly failureReason: string | null;
  fire<P extends CapabilityTransitionId>(id: P, payload: TransitionPayloadMap[P]): TransitionResult;
}

interface Internals {
  state: CapabilityState;
  capability: CapabilityContract;
  compatibility: CompatibilityDecision | null;
  rejectionReason: string | null;
  failureReason: string | null;
}

function rejectGuard(check: Check): Check {
  if (!check.ok) return { ok: true };
  return {
    ok: false,
    reason:
      "guard ¬inputs_outputs_typed does not hold: the capability declaration is typed, so it cannot be rejected for missing types",
  };
}

function guardHolds(
  capability: CapabilityContract,
  id: CapabilityTransitionId,
  payload: TransitionPayloadMap[CapabilityTransitionId],
): Check {
  if (id === "validate_capability") return inputsOutputsTyped(capability.io);
  if (id === "reject_capability") return rejectGuard(inputsOutputsTyped(capability.io));
  if (id === "register_capability") return evaluationContractDeclared(capability.evaluation);
  return compatibilityExplicit(payload as CompatibilityDecision);
}

function rejectionCause(capability: CapabilityContract): string {
  const check = inputsOutputsTyped(capability.io);
  return check.ok ? "untyped" : check.reason;
}

function refuse(internals: Internals, reason: string): TransitionResult {
  internals.failureReason = reason;
  return { ok: false, reason };
}

function applyEffect(
  internals: Internals,
  id: CapabilityTransitionId,
  guardReason: string | null,
  payload: TransitionPayloadMap[CapabilityTransitionId],
): void {
  const row = CAPABILITY_TRANSITIONS.find((r) => r.id === id) as TransitionRow;
  internals.state = row.to;
  if (id === "reject_capability") internals.rejectionReason = guardReason;
  if (id === "deprecate_capability") internals.compatibility = payload as CompatibilityDecision;
}

function fireTransition(
  internals: Internals,
  id: CapabilityTransitionId,
  payload: TransitionPayloadMap[CapabilityTransitionId],
): TransitionResult {
  const row = CAPABILITY_TRANSITIONS.find((r) => r.id === id);
  if (!row) return refuse(internals, `unknown transition ${id}`);
  if (internals.state !== row.from) {
    return refuse(internals, `transition ${id} cannot fire from state ${internals.state}`);
  }
  const guard = guardHolds(internals.capability, id, payload);
  if (!guard.ok) return refuse(internals, guard.reason);
  const cause = id === "reject_capability" ? rejectionCause(internals.capability) : null;
  applyEffect(internals, id, cause, payload);
  internals.failureReason = null;
  return { ok: true };
}

function makeMachine(internals: Internals): CapabilityMachine {
  return {
    get capability() {
      return internals.capability;
    },
    get state() {
      return internals.state;
    },
    get compatibility() {
      return internals.compatibility;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    get failureReason() {
      return internals.failureReason;
    },
    fire: <P extends CapabilityTransitionId>(id: P, payload: TransitionPayloadMap[P]) =>
      fireTransition(internals, id, payload as TransitionPayloadMap[CapabilityTransitionId]),
  };
}

export function createCapabilityMachine(capability: CapabilityContract): CapabilityMachine {
  const internals: Internals = {
    state: "proposed",
    capability,
    compatibility: null,
    rejectionReason: null,
    failureReason: null,
  };
  return makeMachine(internals);
}