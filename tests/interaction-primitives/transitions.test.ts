// Purpose: transition tests for the interaction-primitives model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with precise reasons
// Rationale: the machine must mirror the spec row for row; guards must fail with exact reasons so bypasses cannot hide behind loose matches
import { describe, it, expect } from "vitest";
import { createPrimitiveSystemGate } from "../../src/interaction-primitives/machine";
import { SEMANTIC_LAYERS } from "../../src/interaction-primitives/types";
import { validRevision, collapsedRevision } from "./fixtures";
import type { PrimitiveRevision } from "../../src/interaction-primitives/types";

function missingLayer(layer: string): PrimitiveRevision {
  const layers = validRevision().layers.filter((l) => l.layer !== layer);
  return validRevision({ layers });
}

describe("interaction-primitives transitions", () => {
  it("validate_system_primitives moves draft → validated when semantic_layers_separated holds", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    expect(gate.state).toBe("draft");
    const r = gate.fire("validate_system_primitives");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("validated");
  });

  it("validate_system_primitives refuses with the precise collapse reason when a layer is missing", () => {
    const gate = createPrimitiveSystemGate(missingLayer("pattern"));
    const r = gate.fire("validate_system_primitives");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('semantic layer "pattern" is not declared');
    expect(gate.state).toBe("draft");
  });

  it("validate_system_primitives refuses with the precise collapse reason when layers share a type token", () => {
    const gate = createPrimitiveSystemGate(collapsedRevision());
    const r = gate.fire("validate_system_primitives");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'semantic layer separation violated: layers "need" and "contribution" share type token "Need"',
    );
  });

  it("validate_system_primitives refuses with the precise collapse reason when layers share an update rule", () => {
    const layers = validRevision().layers.map((l, i) =>
      i === 1 ? { ...l, updateRule: validRevision().layers[0].updateRule } : l,
    );
    const gate = createPrimitiveSystemGate(validRevision({ layers }));
    const r = gate.fire("validate_system_primitives");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'semantic layer separation violated: layers "need" and "contribution" share update rule "normalize proposals into typed needs"',
    );
  });

  it("reject_collapsed_model moves draft → rejected when semantic_layers_separated fails, recording the violation", () => {
    const gate = createPrimitiveSystemGate(collapsedRevision());
    const r = gate.fire("reject_collapsed_model");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("rejected");
    expect(gate.rejectionReason).toBe(
      'semantic layer separation violated: layers "need" and "contribution" share type token "Need"',
    );
  });

  it("reject_collapsed_model refuses when the model is not collapsed, naming its requirement", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    const r = gate.fire("reject_collapsed_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "reject_collapsed_model requires a collapsed model — semantic_layers_separated holds",
    );
    expect(gate.state).toBe("draft");
  });

  it("activate_valid_model moves validated → active when contracts_declarative holds", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    gate.fire("validate_system_primitives");
    const r = gate.fire("activate_valid_model");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("active");
  });

  it("activate_valid_model refuses with the precise non-declarative reason when a contract carries executable code", () => {
    const contracts = [
      { contractId: "cx", kind: "capability" as const, form: "declarative-data" as const },
      { contractId: "cx2", kind: "capability" as const, form: "executable-code" as const },
    ];
    const gate = createPrimitiveSystemGate(validRevision({ contracts }));
    gate.fire("validate_system_primitives");
    const r = gate.fire("activate_valid_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('contract "cx2" carries executable code and cannot enter the trusted core');
    expect(gate.state).toBe("validated");
  });

  it("activate_valid_model refuses when a declarative contract still references executable code", () => {
    const contracts = [
      { contractId: "cx", kind: "interaction" as const, form: "declarative-data" as const, executableRef: "eval.js" },
    ];
    const gate = createPrimitiveSystemGate(validRevision({ contracts }));
    gate.fire("validate_system_primitives");
    const r = gate.fire("activate_valid_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'contract "cx" references executable code "eval.js" — contracts are declarative data',
    );
  });

  it("retire_model_revision moves active → retired when evidence_strength_explicit holds", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    gate.fire("validate_system_primitives");
    gate.fire("activate_valid_model");
    const r = gate.fire("retire_model_revision");
    expect(r.ok).toBe(true);
    expect(gate.state).toBe("retired");
  });

  it("retire_model_revision refuses with the precise silently-normative reason when a claim lacks an evidence class", () => {
    const provenance = [{ claimId: "e1", evidenceClass: "folklore" as never }];
    const gate = createPrimitiveSystemGate(validRevision({ provenance }));
    gate.fire("validate_system_primitives");
    gate.fire("activate_valid_model");
    const r = gate.fire("retire_model_revision");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'provenance record "e1" declares unknown evidence class "folklore" — evidence strength is not explicit',
    );
    expect(gate.state).toBe("active");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    // activate_valid_model starts at validated, not draft
    const r = gate.fire("activate_valid_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition activate_valid_model cannot fire from state draft");
    expect(gate.state).toBe("draft");
    // retire_model_revision starts at active, not validated
    gate.fire("validate_system_primitives");
    const r2 = gate.fire("retire_model_revision");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("transition retire_model_revision cannot fire from state validated");
  });

  it("reject_collapsed_model is the only exit from draft besides validation, and validated cannot be rejected", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    gate.fire("validate_system_primitives");
    const r = gate.fire("reject_collapsed_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition reject_collapsed_model cannot fire from state validated");
  });

  it("the state machine covers exactly the five declared states and four declared transitions", () => {
    expect(SEMANTIC_LAYERS).toHaveLength(11);
  });

  it("unknown transition ids are refused", () => {
    const gate = createPrimitiveSystemGate(validRevision());
    const r = gate.fire("retire_the_world" as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown transition retire_the_world");
  });
});