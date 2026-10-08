// Purpose: transition tests for the capability-contract model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons
import { describe, it, expect } from "vitest";
import {
  createCapabilityMachine,
  CAPABILITY_TRANSITIONS,
} from "../../src/capability-contract/machine";
import type { TransitionPayloadMap } from "../../src/capability-contract/types";
import {
  validCompatibility,
  validContract,
  validEvaluation,
  validIo,
} from "./fixtures";

const TYPED_REASON =
  "guard inputs_outputs_typed does not hold: capability declaration does not declare error result types";

describe("capability-contract transitions", () => {
  it("validate_capability moves proposed → validated when inputs_outputs_typed holds", () => {
    const m = createCapabilityMachine(validContract());
    const r = m.fire("validate_capability", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
    expect(m.failureReason).toBe(null);
  });

  it("validate_capability refuses to fire when the declaration omits error result types", () => {
    const m = createCapabilityMachine(
      validContract({ io: validIo({ errorResultTypes: [] }) }),
    );
    const r = m.fire("validate_capability", undefined);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(TYPED_REASON);
    expect(m.state).toBe("proposed");
  });

  it("reject_capability moves proposed → rejected when inputs_outputs_typed does not hold", () => {
    const m = createCapabilityMachine(
      validContract({ io: validIo({ errorResultTypes: [] }) }),
    );
    const r = m.fire("reject_capability", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rejected");
    expect(m.rejectionReason).toBe(TYPED_REASON);
  });

  it("reject_capability refuses to fire when the declaration is typed", () => {
    const m = createCapabilityMachine(validContract());
    const r = m.fire("reject_capability", undefined);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard ¬inputs_outputs_typed does not hold: the capability declaration is typed, so it cannot be rejected for missing types",
    );
    expect(m.state).toBe("proposed");
  });

  it("register_capability moves validated → registered when evaluation_contract_declared holds", () => {
    const m = createCapabilityMachine(validContract());
    m.fire("validate_capability", undefined);
    const r = m.fire("register_capability", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("registered");
  });

  it("register_capability refuses to fire when the evaluation contract omits the safety-invariant failure behavior", () => {
    const m = createCapabilityMachine(
      validContract({
        evaluation: validEvaluation({ safetyCheckFailureBehavior: "" }),
      }),
    );
    m.fire("validate_capability", undefined);
    const r = m.fire("register_capability", undefined);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard evaluation_contract_declared does not hold: capability declaration does not declare the behavior required when a safety invariant fails",
    );
    expect(m.state).toBe("validated");
  });

  it("deprecate_capability moves registered → deprecated when compatibility_explicit holds", () => {
    const m = createCapabilityMachine(validContract());
    m.fire("validate_capability", undefined);
    m.fire("register_capability", undefined);
    const r = m.fire("deprecate_capability", validCompatibility());
    expect(r.ok).toBe(true);
    expect(m.state).toBe("deprecated");
    expect(m.compatibility).toEqual(validCompatibility());
  });

  it("deprecate_capability refuses to fire when the decision is not paired with a migration strategy", () => {
    const m = createCapabilityMachine(validContract());
    m.fire("validate_capability", undefined);
    m.fire("register_capability", undefined);
    const r = m.fire("deprecate_capability", validCompatibility({ migrationStrategy: "" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard compatibility_explicit does not hold: compatibility decision is not paired with a migration strategy",
    );
    expect(m.state).toBe("registered");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const payloads: TransitionPayloadMap = {
      validate_capability: undefined,
      reject_capability: undefined,
      register_capability: undefined,
      deprecate_capability: validCompatibility(),
    };
    const m = createCapabilityMachine(validContract());
    for (const row of CAPABILITY_TRANSITIONS) {
      if (row.from === "proposed") continue;
      const r = m.fire(row.id, payloads[row.id]);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`transition ${row.id} cannot fire from state proposed`);
    }
    expect(m.state).toBe("proposed");
    // a fired transition cannot refire from its target state
    expect(m.fire("validate_capability", undefined).ok).toBe(true);
    const again = m.fire("validate_capability", undefined);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe("transition validate_capability cannot fire from state validated");
  });
});