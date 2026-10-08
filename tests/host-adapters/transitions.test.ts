// Purpose: transition tests for the host adapter model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: the table-driven machine must mirror [[spec]] row for row; guards fail with exact reasons
//   (no masked violations) so negative tests assert the precise failure string
import { describe, it, expect } from "vitest";
import { createHostAdapter, ADAPTER_TRANSITIONS } from "../../src/host-adapters/index";
import type { HostAdapter } from "../../src/host-adapters/index";
import { capability, responseFor, validContract } from "./fixtures";
import type { InteractionContract } from "./fixtures";

function received(contract: InteractionContract = validContract(), cap = capability()): HostAdapter {
  return createHostAdapter(contract, cap);
}

function capabilityChecked(
  contract: InteractionContract = validContract(),
  cap = capability(),
): HostAdapter {
  const m = received(contract, cap);
  expect(m.fire("validate_received_contract").ok).toBe(true);
  return m;
}

function rendered(contract: InteractionContract = validContract(), cap = capability()): HostAdapter {
  const m = capabilityChecked(contract, cap);
  expect(m.fire("render_supported_kind").ok).toBe(true);
  return m;
}

function unsupportedMachine(): HostAdapter {
  // kind "rank" is a valid pinned catalog kind the adapter neither supports nor
  // has a registered fallback for — capability discovery must surface it
  const m = capabilityChecked(validContract({ kind: "rank" }), capability({ fallbacks: {} }));
  expect(m.fire("render_supported_kind").ok).toBe(false);
  const r = m.fire("report_unsupported_kind");
  expect(r.ok).toBe(true);
  return m;
}

function rejectedResponseMachine(): HostAdapter {
  const m = rendered();
  const stale = responseFor(m.contract, { interactionRevision: "rev-0" });
  expect(m.fire("reject_core_invalid_response", { response: stale }).ok).toBe(true);
  return m;
}

function acceptedMachine(): HostAdapter {
  const m = rendered();
  expect(m.fire("accept_core_valid_response", { response: responseFor(m.contract) }).ok).toBe(true);
  return m;
}

describe("host-adapters transitions", () => {
  it("validate_received_contract moves received → capability_checked when the contract guard holds", () => {
    const m = received();
    const r = m.fire("validate_received_contract");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("capability_checked");
  });

  it("validate_received_contract refuses an invalid contract, naming the precise reason", () => {
    const m = received(validContract({ interactionRevision: "" }));
    const r = m.fire("validate_received_contract");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      "incoming_contract_valid does not hold: contract_has_identity_and_version does not hold: missing interaction revision",
    );
    expect(m.state).toBe("received");
  });

  it("reject_invalid_received_contract moves received → invalid_contract when the contract guard fails", () => {
    const m = received(validContract({ kind: "not_a_kind" }));
    const r = m.fire("reject_invalid_received_contract");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("invalid_contract");
    expect(m.rejectionReason).toBe(
      'incoming_contract_valid does not hold: contract_kind_allowlisted does not hold: "not_a_kind" is not a kind in the pinned host-neutral catalog',
    );
  });

  it("reject_invalid_received_contract refuses a valid contract — the inverse guard is precise", () => {
    const m = received();
    const r = m.fire("reject_invalid_received_contract");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      "guard ¬(incoming_contract_valid) does not hold — the received contract is valid; use validate_received_contract",
    );
    expect(m.state).toBe("received");
  });

  it("render_supported_kind moves capability_checked → rendered when the kind guard holds", () => {
    const m = capabilityChecked();
    const r = m.fire("render_supported_kind");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rendered");
  });

  it("render_supported_kind refuses an unsupported kind, naming the kind and host", () => {
    const m = capabilityChecked(validContract({ kind: "rank" }), capability({ fallbacks: {} }));
    const r = m.fire("render_supported_kind");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      'requested_kind_supported does not hold: kind "rank" is not declared supported and has no registered semantic fallback on host "pi-tui"',
    );
    expect(m.state).toBe("capability_checked");
  });

  it("report_unsupported_kind moves capability_checked → unsupported when the kind guard fails", () => {
    const m = capabilityChecked(validContract({ kind: "rank" }), capability({ fallbacks: {} }));
    const r = m.fire("report_unsupported_kind");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("unsupported");
    expect(m.unsupportedResult).not.toBeNull();
    expect(m.unsupportedResult?.ok).toBe(false);
  });

  it("report_unsupported_kind refuses a supported kind — the inverse guard is precise", () => {
    const m = capabilityChecked();
    const r = m.fire("report_unsupported_kind");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      'guard ¬(requested_kind_supported) does not hold — kind "choose" is renderable; use render_supported_kind',
    );
    expect(m.state).toBe("capability_checked");
  });

  it("accept_core_valid_response moves rendered → accepted when the core revalidation guard holds", () => {
    const m = rendered();
    const r = m.fire("accept_core_valid_response", { response: responseFor(m.contract) });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("accepted");
    expect(m.commitReceipt).toBe("commit:evt-1");
    expect(m.events).toHaveLength(1);
  });

  it("accept_core_valid_response refuses a stale response, naming the core's precise reason", () => {
    const m = rendered();
    const stale = responseFor(m.contract, { interactionRevision: "rev-0" });
    const r = m.fire("accept_core_valid_response", { response: stale });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      "response_revalidated_by_core does not hold: response_correlated does not hold: response interaction revision does not match the originating contract",
    );
    expect(m.state).toBe("rendered");
    expect(m.events).toHaveLength(0);
  });

  it("reject_core_invalid_response moves rendered → rejected_response when the core revalidation guard fails", () => {
    const m = rendered();
    const stale = responseFor(m.contract, { taskRevisionPrecondition: "task-0" });
    const r = m.fire("reject_core_invalid_response", { response: stale });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rejected_response");
    expect(m.rejectedResponseReason).toBe(
      "response_correlated does not hold: response task revision precondition does not match the originating contract",
    );
  });

  it("reject_core_invalid_response refuses a core-accepted response — the inverse guard is precise", () => {
    const m = rendered();
    const r = m.fire("reject_core_invalid_response", { response: responseFor(m.contract) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(
      "guard ¬(response_revalidated_by_core) does not hold — the core accepted the response; use accept_core_valid_response",
    );
    expect(m.state).toBe("rendered");
  });

  it("retry_with_valid_contract moves invalid_contract → received when a new valid contract arrives", () => {
    const m = received(validContract({ interactionRevision: "" }));
    m.fire("reject_invalid_received_contract");
    const r = m.fire("retry_with_valid_contract", { nextContract: validContract() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("received");
    expect(m.rejectionReason).toBeNull();
    expect(m.contract.interactionRevision).toBe("rev-1");
  });

  it("retry_with_valid_contract fails precisely without new input or with an invalid contract", () => {
    const m = received(validContract({ interactionRevision: "" }));
    m.fire("reject_invalid_received_contract");
    const noInput = m.fire("retry_with_valid_contract");
    expect(noInput.ok).toBe(false);
    if (!noInput.ok) {
      expect(noInput.reason).toBe(
        "adapter_uses_shared_contract does not hold: retry requires a new host-neutral contract as input",
      );
    }
    const badInput = m.fire("retry_with_valid_contract", {
      nextContract: validContract({ kind: "not_a_kind" }),
    });
    expect(badInput.ok).toBe(false);
    if (!badInput.ok) {
      expect(badInput.reason).toBe(
        'adapter_uses_shared_contract does not hold: incoming_contract_valid does not hold: contract_kind_allowlisted does not hold: "not_a_kind" is not a kind in the pinned host-neutral catalog',
      );
    }
    expect(m.state).toBe("invalid_contract");
  });

  it("select_registered_fallback moves unsupported → received when a compatible interaction arrives", () => {
    const m = unsupportedMachine();
    const r = m.fire("select_registered_fallback", { nextContract: validContract() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("received");
    expect(m.unsupportedResult).toBeNull();
  });

  it("select_registered_fallback fails precisely without new input or a still-unsupported kind", () => {
    const m = unsupportedMachine();
    const noInput = m.fire("select_registered_fallback");
    expect(noInput.ok).toBe(false);
    if (!noInput.ok) {
      expect(noInput.reason).toBe(
        "new_compatible_interaction_received does not hold: returning to receipt requires a new interaction or explicit alternate contract",
      );
    }
    const stillUnsupported = m.fire("select_registered_fallback", {
      nextContract: validContract({ kind: "rank", interactionId: "ix-alt-1" }),
    });
    expect(stillUnsupported.ok).toBe(false);
    if (!stillUnsupported.ok) {
      expect(stillUnsupported.reason).toBe(
        'new_compatible_interaction_received does not hold: the supplied interaction still requests unsupported kind "rank"; an explicit alternate contract is required',
      );
    }
    expect(m.state).toBe("unsupported");
  });

  it("correct_rejected_response moves rejected_response → received when a new response arrives", () => {
    const m = rejectedResponseMachine();
    const fresh = responseFor(m.contract, { eventId: "evt-2" });
    const r = m.fire("correct_rejected_response", { response: fresh });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("received");
    expect(m.rejectedResponseReason).toBeNull();
  });

  it("correct_rejected_response fails precisely without a new user response", () => {
    const m = rejectedResponseMachine();
    const noInput = m.fire("correct_rejected_response");
    expect(noInput.ok).toBe(false);
    if (!noInput.ok) {
      expect(noInput.reason).toBe(
        "new_response_received does not hold: returning to receipt requires a new user response",
      );
    }
    const identical = m.fire("correct_rejected_response", {
      response: responseFor(m.contract, { interactionRevision: "rev-0" }),
    });
    expect(identical.ok).toBe(false);
    if (!identical.ok) {
      expect(identical.reason).toBe(
        "new_response_received does not hold: the submitted response is identical to the rejected response; a new user response is required",
      );
    }
    expect(m.state).toBe("rejected_response");
  });

  it("continue_after_acceptance moves accepted → received once the core commit result is recorded", () => {
    const m = acceptedMachine();
    expect(m.commitReceipt).toBe("commit:evt-1");
    const r = m.fire("continue_after_acceptance");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("received");
  });

  it("continue_after_acceptance refuses to fire before the response is accepted", () => {
    const m = rendered();
    const r = m.fire("continue_after_acceptance");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("transition continue_after_acceptance cannot fire from state rendered");
    expect(m.state).toBe("rendered");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const fromReceived = new Set(
      ADAPTER_TRANSITIONS.filter((t) => t.from === "received").map((t) => t.id),
    );
    const m = received();
    for (const t of ADAPTER_TRANSITIONS) {
      if (fromReceived.has(t.id)) continue;
      const r = m.fire(t.id);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(`transition ${t.id} cannot fire from state received`);
    }
  });
});