// Purpose: transition tests for the contribution-primitives model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with the precise declared reason
import { describe, it, expect } from "vitest";
import { createPrimitiveMachine } from "../../src/contribution-primitives/machine";
import { PRIMITIVE_TRANSITIONS } from "../../src/contribution-primitives/machine";
import type { TransitionResult } from "../../src/contribution-primitives/types";
import { validProposal, proposalOfKind, escapeArg, retireArg } from "./fixtures";

function expectFail(r: TransitionResult): string {
  if (r.ok) throw new Error("expected the transition to fail");
  return r.reason;
}

describe("contribution-primitives transitions", () => {
  it("validate_primitive moves proposed → validated when the semantic-atomicity guard holds", () => {
    const m = createPrimitiveMachine(validProposal());
    const r = m.fire("validate_primitive");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("validate_primitive refuses compound activities with the exact pattern-not-primitive reason", () => {
    const m = createPrimitiveMachine(proposalOfKind("express", { kind: "review" }));
    const r = m.fire("validate_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "compound activity review is an interaction pattern, not a single primitive — split it into primitives or revise the taxonomy explicitly",
    );
    expect(m.state).toBe("proposed");
  });

  it("validate_primitive refuses unknown kinds with the exact unsupported-kind reason", () => {
    const m = createPrimitiveMachine(validProposal({ kind: "wibble" }));
    const r = m.fire("validate_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("unsupported primitive kind: wibble (taxonomy primitive-taxonomy-2026.10-provisional)");
    expect(m.state).toBe("proposed");
  });

  it("reject_invalid_primitive moves proposed → invalid when the semantic-atomicity guard fails, recording the reason", () => {
    const m = createPrimitiveMachine(proposalOfKind("express", { kind: "diagnosis" }));
    const r = m.fire("reject_invalid_primitive");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("invalid");
    expect(m.invalidReason).toBe(
      "compound activity diagnosis is an interaction pattern, not a single primitive — split it into primitives or revise the taxonomy explicitly",
    );
  });

  it("reject_invalid_primitive refuses a valid primitive with the exact requires-invalid reason", () => {
    const m = createPrimitiveMachine(validProposal());
    const r = m.fire("reject_invalid_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("reject_invalid_primitive requires an invalid primitive");
    expect(m.state).toBe("proposed");
  });

  it("activate_primitive moves validated → active when the typed-event guard holds", () => {
    const m = createPrimitiveMachine(validProposal());
    m.fire("validate_primitive");
    const r = m.fire("activate_primitive");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("active");
  });

  it("activate_primitive refuses a proposal without provenance with the exact typed-event reason", () => {
    const m = createPrimitiveMachine(validProposal({ provenance: [] }));
    m.fire("validate_primitive");
    const r = m.fire("activate_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("guard primitive_event_typed does not hold: primitive event requires provenance");
    expect(m.state).toBe("validated");
  });

  it("activate_primitive refuses a proposal without an interaction identity with the exact typed-event reason", () => {
    const m = createPrimitiveMachine(validProposal({ interactionId: "" }));
    m.fire("validate_primitive");
    const r = m.fire("activate_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("guard primitive_event_typed does not hold: primitive event requires an interaction identity");
    expect(m.state).toBe("validated");
  });

  it("complete_primitive moves active → completed and emits the typed event when the payload guard holds", () => {
    const m = createPrimitiveMachine(validProposal({ responsePayload: { choice: "b" } }));
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    const r = m.fire("complete_primitive");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("completed");
    expect(m.event).toEqual({
      kind: "select",
      taxonomyVersion: "primitive-taxonomy-2026.10-provisional",
      interactionId: "ixn-1",
      taskRevision: "task-7",
      payload: { choice: "b" },
      provenance: ["ev-1", "ev-2"],
      emittedBy: "contribution-primitives-machine@1.0.0",
    });
  });

  it("complete_primitive refuses to emit without a response payload with the exact typed-event reason", () => {
    const m = createPrimitiveMachine(validProposal());
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    const r = m.fire("complete_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard primitive_event_typed does not hold: primitive event requires a response payload",
    );
    expect(m.state).toBe("active");
    expect(m.event).toBeNull();
  });

  it("escape_primitive moves active → escaped for a declared outcome, recording the workflow effect", () => {
    const m = createPrimitiveMachine(validProposal());
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    const r = m.fire("escape_primitive", escapeArg("cancel"));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("escaped");
    expect(m.escapeRecord).toEqual({
      kind: "select",
      outcome: "cancel",
      workflowEffect:
        "the workflow cancels the contribution without a substantive response",
      responsePayload: undefined,
    });
  });

  it("escape_primitive refuses an undeclared outcome with the exact explicit-escape reason", () => {
    const m = createPrimitiveMachine(
      validProposal({ escapeDeclaration: { cancel: "the workflow cancels the contribution without a substantive response" } }),
    );
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    const r = m.fire("escape_primitive", escapeArg("dismiss"));
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard escape_semantics_explicit does not hold: escape outcome dismiss is not declared for kind select",
    );
    expect(m.state).toBe("active");
  });

  it("retire_primitive moves completed → retired when an explicit taxonomy revision is cited", () => {
    const m = createPrimitiveMachine(validProposal({ responsePayload: { choice: "a" } }));
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    m.fire("complete_primitive");
    const r = m.fire("retire_primitive", retireArg("primitive-taxonomy-2026.11"));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("retired");
  });

  it("retire_primitive refuses a silent retirement with the exact versioned-taxonomy reason", () => {
    const m = createPrimitiveMachine(validProposal({ responsePayload: { choice: "a" } }));
    m.fire("validate_primitive");
    m.fire("activate_primitive");
    m.fire("complete_primitive");
    const r = m.fire("retire_primitive");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard primitive_taxonomy_versioned does not hold: retirement requires an explicit taxonomy revision",
    );
    expect(m.state).toBe("completed");
  });

  it("every transition refuses to fire from a state it does not originate from, naming the transition and state", () => {
    const m = createPrimitiveMachine(validProposal());
    const r = m.fire("escape_primitive", escapeArg("cancel"));
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("transition escape_primitive cannot fire from state proposed");
    expect(m.state).toBe("proposed");
    const r2 = m.fire("complete_primitive");
    expect(expectFail(r2)).toBe("transition complete_primitive cannot fire from state proposed");
  });

  it("the machine transition table mirrors the spec model row for row", () => {
    expect(PRIMITIVE_TRANSITIONS).toEqual([
      { id: "validate_primitive", from: "proposed", to: "validated" },
      { id: "reject_invalid_primitive", from: "proposed", to: "invalid" },
      { id: "activate_primitive", from: "validated", to: "active" },
      { id: "complete_primitive", from: "active", to: "completed" },
      { id: "escape_primitive", from: "active", to: "escaped" },
      { id: "retire_primitive", from: "completed", to: "retired" },
    ]);
  });
});