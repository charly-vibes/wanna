// Purpose: invariants for the host adapter layer
// Responsibilities: incoming-contract validity, capability discovery, core revalidation delegate, keyboard operability
// Rationale: each invariant returns a precise failure reason so negative tests can assert it —
//   adapters consume the same shared contract vocabulary as the core (no redefined schemas)
import { acceptResponse, contractPayloadValid } from "../interaction-contract/invariants";
import type { ContractResponse, InteractionContract } from "../interaction-contract/types";
import type { CapabilityResult, Check, CoreValidation, CoreValidator, HostCapability } from "./types";

/** [[spec.incoming_contract_valid]] — a received interaction uses a valid versioned host-neutral contract. */
export function incomingContractValid(contract: InteractionContract): Check {
  const shared = contractPayloadValid(contract);
  if (!shared.ok) return { ok: false, reason: `incoming_contract_valid does not hold: ${shared.reason}` };
  return { ok: true };
}

/** [[spec.requested_kind_supported]] + [[spec.host_capability_explicit]] — capability discovery. */
export function checkCapability(contract: InteractionContract, capability: HostCapability): CapabilityResult {
  const kind = contract.kind;
  if (capability.supportedKinds.includes(kind)) {
    return { ok: true, mode: "native", renderKind: kind };
  }
  return registeredFallback(kind, capability);
}

function registeredFallback(kind: string, capability: HostCapability): CapabilityResult {
  const fallback = capability.fallbacks[kind];
  if (fallback === undefined) {
    return {
      ok: false,
      reason:
        `kind "${kind}" is not declared supported and has no registered semantic fallback ` +
        `on host "${capability.host}"`,
    };
  }
  if (!capability.supportedKinds.includes(fallback)) {
    return {
      ok: false,
      reason:
        `kind "${kind}" has a registered fallback "${fallback}" that the adapter itself does not ` +
        `support on host "${capability.host}"`,
    };
  }
  return { ok: true, mode: "fallback", renderKind: fallback };
}

/** [[spec.response_revalidated_by_core]] — the canonical core revalidation delegate. */
export function coreRevalidatesResponse(seenEventIds: Set<string>): CoreValidator {
  return (response: ContractResponse, contract: InteractionContract): CoreValidation => {
    const verdict = acceptResponse(contract, response, seenEventIds);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    return { ok: true, commitReceipt: `commit:${response.eventId}` };
  };
}

/** [[spec.semantic_accessibility_preserved]] — the host exposes a keyboard input mode. */
export function keyboardOperable(capability: HostCapability): boolean {
  return capability.inputModes.includes("keyboard");
}