// Purpose: transition tests for the interaction-security model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with precise failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons, not loose matches
import { describe, it, expect } from "vitest";
import { SECURITY_TRANSITIONS, createSecurityGate } from "../../src/interaction-security/machine";
import { agentPayload, trustedCatalog, trustedOwnership, trustedPolicy } from "./fixtures";

describe("interaction-security transitions", () => {
  it("accept_validated_payload moves untrusted → validated when payload_passes_security_validation holds", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const r = gate.fire("accept_validated_payload");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("validated");
    expect(gate.validated).not.toBeNull();
  });

  it("accept_validated_payload refuses with the precise guard reason when any check fails", () => {
    const gate = createSecurityGate(
      agentPayload({ options: Array.from({ length: 9 }, (_, i) => `opt-${i}`) }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const r = gate.fire("accept_validated_payload");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard payload_passes_security_validation does not hold: size check failed: option count 9 exceeds maxOptionCount (8)",
    );
    expect(gate.state).toBe("untrusted");
  });

  it("reject_untrusted_payload moves untrusted → rejected when the validation guard fails, with a stable reason code", () => {
    const gate = createSecurityGate(
      agentPayload({ kind: "not_a_kind" }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const r = gate.fire("reject_untrusted_payload");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("rejected");
    expect(gate.rejection).not.toBeNull();
    expect(gate.rejection?.reasonCode).toBe("kind_not_registered");
    expect(gate.rejection?.detail).toContain("not registered");
  });

  it("reject_untrusted_payload refuses when the payload would pass validation", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const r = gate.fire("reject_untrusted_payload");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reject_untrusted_payload requires a failing payload");
    expect(gate.state).toBe("untrusted");
  });

  it("resubmit_after_rejection moves rejected → untrusted when a new or corrected payload is received", () => {
    const gate = createSecurityGate(
      agentPayload({ kind: "not_a_kind" }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("reject_untrusted_payload");
    const r = gate.resubmit(agentPayload({ kind: "confirm" }));
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("untrusted");
    // the corrected payload is now the payload under evaluation
    const accept = gate.fire("accept_validated_payload");
    expect(accept.ok).toBe(true);
  });

  it("resubmit_after_rejection refuses an identical payload with the precise guard reason", () => {
    const rejected = agentPayload({ kind: "not_a_kind" });
    const gate = createSecurityGate(
      rejected,
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("reject_untrusted_payload");
    const r = gate.resubmit(agentPayload({ kind: "not_a_kind" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard new_proposal_received does not hold: identical payload resubmitted",
    );
    expect(gate.state).toBe("rejected");
  });

  it("retire_after_use moves validated → retired on an explicit lifecycle event", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("accept_validated_payload");
    const r = gate.retire("consume");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("retired");
  });

  it("retire_after_use refuses without an explicit lifecycle event", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("accept_validated_payload");
    const r = gate.retire();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard interaction_consumed_or_expired does not hold: no lifecycle event",
    );
    expect(gate.state).toBe("validated");
  });

  it("no transition fires from a state it does not originate from", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const wrong = (r: { ok: boolean; reason?: string }, id: string, state: string) => {
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`transition ${id} cannot fire from state ${state}`);
    };
    // from untrusted: resubmit and retire do not originate here
    wrong(gate.resubmit(agentPayload()), "resubmit_after_rejection", "untrusted");
    wrong(gate.retire("consume"), "retire_after_use", "untrusted");
    gate.fire("accept_validated_payload");
    // from validated: accept and reject do not originate here
    wrong(gate.fire("accept_validated_payload"), "accept_validated_payload", "validated");
    wrong(gate.fire("reject_untrusted_payload"), "reject_untrusted_payload", "validated");
    wrong(gate.resubmit(agentPayload()), "resubmit_after_rejection", "validated");
  });

  it("every fired transition is recorded with its declared from and to states", () => {
    const gate = createSecurityGate(
      agentPayload({ kind: "not_a_kind" }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("reject_untrusted_payload");
    gate.resubmit(agentPayload());
    gate.fire("accept_validated_payload");
    gate.retire("expire");
    expect(gate.history.map((h) => `${h.id}:${h.from}->${h.to}`)).toEqual([
      "reject_untrusted_payload:untrusted->rejected",
      "resubmit_after_rejection:rejected->untrusted",
      "accept_validated_payload:untrusted->validated",
      "retire_after_use:validated->retired",
    ]);
    // the recorded rows mirror the declared transition table exactly
    expect(SECURITY_TRANSITIONS.map((t) => t.id)).toEqual([
      "accept_validated_payload",
      "reject_untrusted_payload",
      "resubmit_after_rejection",
      "retire_after_use",
    ]);
  });

  it("an unknown transition id is refused", () => {
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const r = gate.fire("grant_permission" as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown transition grant_permission");
  });
});
