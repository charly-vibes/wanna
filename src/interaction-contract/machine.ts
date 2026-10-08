// Purpose: interaction-contract state machine
// Responsibilities: the four transitions (validate, reject, revise, retire) with their guards
// Rationale: contracts are inert data — the machine is the only mutation path, and retirement or correction is never implied
import type {
  ContractState,
  ContractTransitionId,
  InteractionContract,
  TransitionPayload,
  TransitionResult,
} from "./types";
import { contractPayloadValid, correctedContractReceived, retirementRequested } from "./invariants";

export interface TransitionRow {
  readonly id: ContractTransitionId;
  readonly from: ContractState;
  readonly to: ContractState;
}

export const CONTRACT_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_contract", from: "proposed", to: "validated" },
  { id: "reject_contract", from: "proposed", to: "invalid" },
  { id: "revise_invalid_contract", from: "invalid", to: "proposed" },
  { id: "retire_contract", from: "validated", to: "retired" },
];

export interface ContractMachine {
  readonly state: ContractState;
  readonly contract: InteractionContract;
  readonly rejectionReason: string | null;
  fire(id: ContractTransitionId, payload?: TransitionPayload): TransitionResult;
}

interface Internals {
  state: ContractState;
  contract: InteractionContract;
  rejectionReason: string | null;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function guardHolds(internals: Internals, id: ContractTransitionId, payload?: TransitionPayload): TransitionResult {
  if (id === "validate_contract") return contractPayloadValid(internals.contract);
  if (id === "reject_contract") {
    const check = contractPayloadValid(internals.contract);
    return check.ok ? { ok: false, reason: "reject_contract requires an invalid contract" } : { ok: true };
  }
  if (id === "revise_invalid_contract") return correctedContractReceived(internals.contract, payload?.nextContract);
  return retirementRequested(payload?.command);
}

function applyEffect(internals: Internals, id: ContractTransitionId, payload?: TransitionPayload): void {
  if (id === "validate_contract") {
    internals.state = "validated";
    return;
  }
  if (id === "reject_contract") {
    internals.state = "invalid";
    internals.rejectionReason = contractPayloadValid(internals.contract).reason ?? "invalid contract";
    return;
  }
  if (id === "revise_invalid_contract") {
    internals.state = "proposed";
    internals.contract = deepFreeze({ ...payload!.nextContract! });
    internals.rejectionReason = null;
    return;
  }
  internals.state = "retired";
}

function fireTransition(internals: Internals, id: ContractTransitionId, payload?: TransitionPayload): TransitionResult {
  const row = CONTRACT_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${String(id)}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(internals, id, payload);
  if (!guard.ok) return guard;
  applyEffect(internals, id, payload);
  return { ok: true };
}

function makeMachine(internals: Internals): ContractMachine {
  return {
    get state() {
      return internals.state;
    },
    get contract() {
      return internals.contract;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    fire: (id, payload) => fireTransition(internals, id, payload),
  };
}

export function createContractMachine(contract: InteractionContract): ContractMachine {
  const internals: Internals = {
    state: "proposed",
    contract: deepFreeze({ ...contract }),
    rejectionReason: null,
  };
  return makeMachine(internals);
}