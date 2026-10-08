// Purpose: vocabulary and record shapes for the host adapter layer
// Responsibilities: adapter states, transition ids, host capabilities, capability results, host-neutral events, core validation types
// Rationale: adapters translate the shared host-neutral contract; none of these records expose host libraries
import type { ContractResponse, InteractionContract } from "../interaction-contract/types";
import type { PresentationHandle } from "./presentation";

export type AdapterState =
  | "received"
  | "capability_checked"
  | "rendered"
  | "accepted"
  | "invalid_contract"
  | "unsupported"
  | "rejected_response";

export type AdapterTransitionId =
  | "validate_received_contract"
  | "reject_invalid_received_contract"
  | "render_supported_kind"
  | "report_unsupported_kind"
  | "accept_core_valid_response"
  | "reject_core_invalid_response"
  | "retry_with_valid_contract"
  | "select_registered_fallback"
  | "correct_rejected_response"
  | "continue_after_acceptance";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export interface TransitionRow {
  readonly id: AdapterTransitionId;
  readonly from: AdapterState;
  readonly to: AdapterState;
}

export interface HostCapability {
  readonly host: string;
  readonly supportedKinds: readonly string[];
  readonly fallbacks: Readonly<Record<string, string>>;
  readonly inputModes: readonly string[];
}

export type CapabilityResult =
  | { ok: true; mode: "native" | "fallback"; renderKind: string; reason?: undefined }
  | { ok: false; mode?: undefined; renderKind?: undefined; reason: string };

/** Host-neutral event: identical shape regardless of which host produced the answer. */
export interface HostEvent {
  readonly interactionId: string;
  readonly kind: string;
  readonly eventId: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export type CoreValidation =
  | { ok: true; commitReceipt: string; reason?: undefined }
  | { ok: false; commitReceipt?: undefined; reason: string };

/** The core revalidates every submitted response — the adapter never validates business rules itself. */
export type CoreValidator = (response: ContractResponse, contract: InteractionContract) => CoreValidation;

export interface AdapterPayload {
  readonly response?: ContractResponse;
  readonly nextContract?: InteractionContract;
}

export interface AdapterInternals {
  state: AdapterState;
  contract: InteractionContract;
  readonly capability: HostCapability;
  readonly core: CoreValidator;
  readonly seenEventIds: Set<string>;
  readonly events: HostEvent[];
  rejectionReason: string | null;
  unsupportedResult: CapabilityResult | null;
  rejectedResponseReason: string | null;
  rejectedResponse: ContractResponse | null;
  renderKind: string | null;
  commitReceipt: string | null;
  acceptedEventId: string | null;
  disconnected: boolean;
}

export type PresentResult =
  | { ok: true; handle: PresentationHandle; reason?: undefined }
  | { ok: false; handle?: undefined; reason: string };

export type AdapterHandler = (internals: AdapterInternals, payload?: AdapterPayload) => TransitionResult;