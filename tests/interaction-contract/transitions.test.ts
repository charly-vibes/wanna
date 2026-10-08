// Purpose: transition tests for the interaction-contract model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise reasons
import { describe, it, expect } from "vitest";
import { createContractMachine } from "../../src/interaction-contract/machine";
import { validContract } from "./fixtures";

describe("interaction-contract transitions", () => {
  it("validate_contract moves proposed → validated when the payload guard holds", () => {
    const m = createContractMachine(validContract());
    const r = m.fire("validate_contract");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("reject_contract moves proposed → invalid and records the precise guard failure", () => {
    const m = createContractMachine(validContract({ kind: "confetti_cannon" }));
    const r = m.fire("reject_contract");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("invalid");
    expect(m.rejectionReason).toBe(
      'contract_kind_allowlisted does not hold: "confetti_cannon" is not a kind in the pinned host-neutral catalog',
    );
  });

  it("revise_invalid_contract moves invalid → proposed only when a corrected payload arrives", () => {
    const invalid = validContract({ kind: "confetti_cannon" });
    const m = createContractMachine(invalid);
    m.fire("reject_contract");
    // no corrected payload supplied at all
    expect(m.fire("revise_invalid_contract").reason).toBe(
      "corrected_contract_received does not hold: no corrected contract payload was supplied",
    );
    expect(m.state).toBe("invalid");
    // the identical rejected payload is not a correction
    expect(m.fire("revise_invalid_contract", { nextContract: invalid }).reason).toBe(
      "corrected_contract_received does not hold: the supplied contract is identical to the rejected one; a new or corrected payload is required",
    );
    expect(m.state).toBe("invalid");
    // a corrected payload re-proposes
    const corrected = validContract({ interactionId: "ix-contract-2" });
    expect(m.fire("revise_invalid_contract", { nextContract: corrected }).ok).toBe(true);
    expect(m.state).toBe("proposed");
    expect(m.rejectionReason).toBeNull();
  });

  it("retire_contract moves validated → retired when retirement_requested holds", () => {
    const m = createContractMachine(validContract());
    m.fire("validate_contract");
    const r = m.fire("retire_contract", { command: { retire: true, reason: "request withdrawn" } });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("retired");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createContractMachine(validContract());
    // revise_invalid_contract starts at invalid, not proposed
    expect(m.fire("revise_invalid_contract", { nextContract: validContract() }).reason).toBe(
      "transition revise_invalid_contract cannot fire from state proposed",
    );
    // retire_contract starts at validated, not proposed
    expect(m.fire("retire_contract", { command: { retire: true, reason: "x" } }).reason).toBe(
      "transition retire_contract cannot fire from state proposed",
    );
    // validate_contract starts at proposed, not invalid
    const bad = createContractMachine(validContract({ kind: "confetti_cannon" }));
    bad.fire("reject_contract");
    expect(bad.fire("validate_contract").reason).toBe(
      "transition validate_contract cannot fire from state invalid",
    );
  });
});