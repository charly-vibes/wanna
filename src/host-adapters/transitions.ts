// Purpose: transition handlers for the host adapter model
// Responsibilities: one handler per [[spec]] ## Model transition — guard evaluation and effect, each returning precise failure reasons
// Rationale: handlers are table-dispatched by the machine; every refusal names the guard and the diagnostic (no masked violations)
import type { AdapterInternals as Internals, AdapterPayload, AdapterTransitionId, HostEvent, TransitionResult } from "./types";
import { checkCapability, incomingContractValid } from "./invariants";

export function wrongState(id: AdapterTransitionId, state: string): TransitionResult {
  return { ok: false, reason: `transition ${id} cannot fire from state ${state}` };
}

function hostEvent(contract: Internals["contract"], response: NonNullable<AdapterPayload["response"]>): HostEvent {
  return {
    interactionId: contract.interactionId,
    kind: contract.kind,
    eventId: response.eventId,
    fields: { ...response.fields },
  };
}

export function validateReceivedContract(i: Internals): TransitionResult {
  if (i.state !== "received") return wrongState("validate_received_contract", i.state);
  const guard = incomingContractValid(i.contract);
  if (!guard.ok) return guard;
  i.state = "capability_checked";
  return { ok: true };
}

export function rejectInvalidReceivedContract(i: Internals): TransitionResult {
  if (i.state !== "received") return wrongState("reject_invalid_received_contract", i.state);
  const guard = incomingContractValid(i.contract);
  if (guard.ok) {
    return {
      ok: false,
      reason:
        "guard ¬(incoming_contract_valid) does not hold — the received contract is valid; use validate_received_contract",
    };
  }
  i.state = "invalid_contract";
  i.rejectionReason = guard.reason ?? "invalid contract";
  return { ok: true };
}

export function renderSupportedKind(i: Internals): TransitionResult {
  if (i.state !== "capability_checked") return wrongState("render_supported_kind", i.state);
  const capability = checkCapability(i.contract, i.capability);
  if (!capability.ok) {
    return { ok: false, reason: `requested_kind_supported does not hold: ${capability.reason}` };
  }
  i.state = "rendered";
  i.renderKind = capability.renderKind;
  return { ok: true };
}

export function reportUnsupportedKind(i: Internals): TransitionResult {
  if (i.state !== "capability_checked") return wrongState("report_unsupported_kind", i.state);
  const capability = checkCapability(i.contract, i.capability);
  if (capability.ok) {
    return {
      ok: false,
      reason:
        `guard ¬(requested_kind_supported) does not hold — kind "${i.contract.kind}" is renderable; ` +
        "use render_supported_kind",
    };
  }
  i.state = "unsupported";
  i.unsupportedResult = capability;
  return { ok: true };
}

export function acceptCoreValidResponse(i: Internals, payload?: AdapterPayload): TransitionResult {
  if (i.state !== "rendered") return wrongState("accept_core_valid_response", i.state);
  const response = payload?.response;
  if (!response) {
    return { ok: false, reason: "response_revalidated_by_core does not hold: no response was supplied" };
  }
  const verdict = i.core(response, i.contract);
  if (!verdict.ok) {
    return { ok: false, reason: `response_revalidated_by_core does not hold: ${verdict.reason}` };
  }
  i.state = "accepted";
  i.commitReceipt = verdict.commitReceipt;
  i.acceptedEventId = response.eventId;
  i.events.push(hostEvent(i.contract, response));
  return { ok: true };
}

export function rejectCoreInvalidResponse(i: Internals, payload?: AdapterPayload): TransitionResult {
  if (i.state !== "rendered") return wrongState("reject_core_invalid_response", i.state);
  const response = payload?.response;
  if (!response) {
    return {
      ok: false,
      reason: "guard ¬(response_revalidated_by_core) does not hold: no response was supplied to revalidate",
    };
  }
  const verdict = i.core(response, i.contract);
  if (verdict.ok) {
    return {
      ok: false,
      reason: "guard ¬(response_revalidated_by_core) does not hold — the core accepted the response; use accept_core_valid_response",
    };
  }
  i.state = "rejected_response";
  i.rejectedResponseReason = verdict.reason;
  i.rejectedResponse = response;
  return { ok: true };
}

export function retryWithValidContract(i: Internals, payload?: AdapterPayload): TransitionResult {
  if (i.state !== "invalid_contract") return wrongState("retry_with_valid_contract", i.state);
  const next = payload?.nextContract;
  if (!next) {
    return {
      ok: false,
      reason: "adapter_uses_shared_contract does not hold: retry requires a new host-neutral contract as input",
    };
  }
  const guard = incomingContractValid(next);
  if (!guard.ok) {
    return { ok: false, reason: `adapter_uses_shared_contract does not hold: ${guard.reason}` };
  }
  i.contract = next;
  i.state = "received";
  i.rejectionReason = null;
  return { ok: true };
}

export function selectRegisteredFallback(i: Internals, payload?: AdapterPayload): TransitionResult {
  if (i.state !== "unsupported") return wrongState("select_registered_fallback", i.state);
  const next = payload?.nextContract;
  if (!next) {
    return {
      ok: false,
      reason:
        "new_compatible_interaction_received does not hold: returning to receipt requires a new interaction or explicit alternate contract",
    };
  }
  return fallbackGuard(i, next);
}

function fallbackGuard(i: Internals, next: Internals["contract"]): TransitionResult {
  const valid = incomingContractValid(next);
  if (!valid.ok) {
    return { ok: false, reason: `new_compatible_interaction_received does not hold: ${valid.reason}` };
  }
  const capability = checkCapability(next, i.capability);
  if (!capability.ok) {
    return {
      ok: false,
      reason:
        `new_compatible_interaction_received does not hold: the supplied interaction still requests ` +
        `unsupported kind "${next.kind}"; an explicit alternate contract is required`,
    };
  }
  i.contract = next;
  i.state = "received";
  i.unsupportedResult = null;
  return { ok: true };
}

export function correctRejectedResponse(i: Internals, payload?: AdapterPayload): TransitionResult {
  if (i.state !== "rejected_response") return wrongState("correct_rejected_response", i.state);
  const response = payload?.response;
  if (!response) {
    return {
      ok: false,
      reason: "new_response_received does not hold: returning to receipt requires a new user response",
    };
  }
  if (i.rejectedResponse && JSON.stringify(i.rejectedResponse) === JSON.stringify(response)) {
    return {
      ok: false,
      reason:
        "new_response_received does not hold: the submitted response is identical to the rejected response; a new user response is required",
    };
  }
  i.state = "received";
  i.rejectedResponseReason = null;
  i.rejectedResponse = null;
  return { ok: true };
}

export function continueAfterAcceptance(i: Internals): TransitionResult {
  if (i.state !== "accepted") return wrongState("continue_after_acceptance", i.state);
  const committed = i.commitReceipt !== null && i.commitReceipt === `commit:${i.acceptedEventId}`;
  if (!committed) {
    return {
      ok: false,
      reason: "interaction_flow_can_continue does not hold: the core commit result for the accepted response is missing",
    };
  }
  i.state = "received";
  return { ok: true };
}