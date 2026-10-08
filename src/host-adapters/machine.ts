// Purpose: the host adapter state machine
// Responsibilities: createHostAdapter — table-dispatched transitions over the seven [[spec]] states, capability discovery, presentation, disconnect
// Rationale: the machine mirrors [[spec]] ## Model row for row; every response is revalidated by the injected core, never by the adapter
import type { InteractionContract } from "../interaction-contract/types";
import type {
  AdapterHandler,
  AdapterInternals,
  AdapterPayload,
  AdapterState,
  AdapterTransitionId,
  CapabilityResult,
  CoreValidator,
  HostCapability,
  HostEvent,
  PresentResult,
  TransitionRow,
  TransitionResult,
} from "./types";
import { checkCapability, coreRevalidatesResponse } from "./invariants";
import { createPresentationHandle, controlsFor } from "./presentation";
import {
  acceptCoreValidResponse,
  continueAfterAcceptance,
  correctRejectedResponse,
  rejectCoreInvalidResponse,
  rejectInvalidReceivedContract,
  renderSupportedKind,
  reportUnsupportedKind,
  retryWithValidContract,
  selectRegisteredFallback,
  validateReceivedContract,
} from "./transitions";

export const ADAPTER_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_received_contract", from: "received", to: "capability_checked" },
  { id: "reject_invalid_received_contract", from: "received", to: "invalid_contract" },
  { id: "render_supported_kind", from: "capability_checked", to: "rendered" },
  { id: "report_unsupported_kind", from: "capability_checked", to: "unsupported" },
  { id: "accept_core_valid_response", from: "rendered", to: "accepted" },
  { id: "reject_core_invalid_response", from: "rendered", to: "rejected_response" },
  { id: "retry_with_valid_contract", from: "invalid_contract", to: "received" },
  { id: "select_registered_fallback", from: "unsupported", to: "received" },
  { id: "correct_rejected_response", from: "rejected_response", to: "received" },
  { id: "continue_after_acceptance", from: "accepted", to: "received" },
];

const HANDLERS: Record<AdapterTransitionId, AdapterHandler> = {
  validate_received_contract: validateReceivedContract,
  reject_invalid_received_contract: rejectInvalidReceivedContract,
  render_supported_kind: renderSupportedKind,
  report_unsupported_kind: reportUnsupportedKind,
  accept_core_valid_response: acceptCoreValidResponse,
  reject_core_invalid_response: rejectCoreInvalidResponse,
  retry_with_valid_contract: retryWithValidContract,
  select_registered_fallback: selectRegisteredFallback,
  correct_rejected_response: correctRejectedResponse,
  continue_after_acceptance: continueAfterAcceptance,
};

export interface HostAdapter {
  readonly contract: InteractionContract;
  readonly capability: HostCapability;
  readonly state: AdapterState;
  readonly rejectionReason: string | null;
  readonly unsupportedResult: CapabilityResult | null;
  readonly rejectedResponseReason: string | null;
  readonly commitReceipt: string | null;
  readonly events: readonly HostEvent[];
  fire(id: AdapterTransitionId, payload?: AdapterPayload): TransitionResult;
  checkCapability(contract?: InteractionContract): CapabilityResult;
  present(): PresentResult;
  disconnect(): void;
}

export function createHostAdapter(
  contract: InteractionContract,
  capability: HostCapability,
  core?: CoreValidator,
): HostAdapter {
  const seenEventIds = new Set<string>();
  const internals: AdapterInternals = {
    state: "received",
    contract,
    capability,
    core: core ?? coreRevalidatesResponse(seenEventIds),
    seenEventIds,
    events: [],
    rejectionReason: null,
    unsupportedResult: null,
    rejectedResponseReason: null,
    rejectedResponse: null,
    renderKind: null,
    commitReceipt: null,
    acceptedEventId: null,
    disconnected: false,
  };
  return adapterSurface(internals);
}

function adapterSurface(i: AdapterInternals): HostAdapter {
  return {
    get contract() {
      return i.contract;
    },
    get capability() {
      return i.capability;
    },
    get state() {
      return i.state;
    },
    get rejectionReason() {
      return i.rejectionReason;
    },
    get unsupportedResult() {
      return i.unsupportedResult;
    },
    get rejectedResponseReason() {
      return i.rejectedResponseReason;
    },
    get commitReceipt() {
      return i.commitReceipt;
    },
    get events() {
      return [...i.events];
    },
    fire: (id, payload) => {
      const handler = HANDLERS[id];
      if (!handler) return { ok: false, reason: `unknown transition ${id}` };
      return handler(i, payload);
    },
    checkCapability: (contract) => checkCapabilityFor(i, contract),
    present: () => presentFor(i),
    disconnect: () => {
      i.disconnected = true;
    },
  };
}

function checkCapabilityFor(i: AdapterInternals, contract?: InteractionContract): CapabilityResult {
  return checkCapability(contract ?? i.contract, i.capability);
}

function presentFor(i: AdapterInternals): PresentResult {
  if (i.disconnected) {
    return { ok: false, reason: "host session is disconnected; resume is governed by the runtime lifecycle" };
  }
  if (i.state !== "rendered" || i.renderKind === null) {
    return { ok: false, reason: `no renderable interaction in state ${i.state}` };
  }
  return { ok: true, handle: createPresentationHandle(i.renderKind, controlsFor(i.contract)) };
}