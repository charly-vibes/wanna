// Purpose: transition tests for the presentation-contract model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: machine must mirror [[spec]] row for row; guards must fail with precise reasons (no loose regexes)
import { describe, it, expect } from "vitest";
import { createPresentationMachine } from "../../src/presentation-contract/machine";
import { renderRequestFor, validDraft } from "./fixtures";

describe("presentation-contract transitions", () => {
  it("validate_presentation moves proposed → validated when the semantic-role guard holds", () => {
    const m = createPresentationMachine(validDraft());
    const r = m.fire("validate_presentation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("reject_presentation moves proposed → unsupported when the semantic-role guard fails, naming the reason", () => {
    const m = createPresentationMachine(validDraft({ role: "navigate" }));
    const r = m.fire("reject_presentation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("unsupported");
    expect(m.rejectionReason).toBe("unsupported semantic role: navigate");
  });

  it("render_with_capabilities moves validated → renderable when the response-semantics guard holds", () => {
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    const r = m.render(renderRequestFor(validDraft()));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("renderable");
  });

  it("use_semantic_fallback moves validated → fallback when the fallback guard holds", () => {
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    const r = m.fallback({ nativeActionIds: [], substitutions: [{ actionId: "choose-target", fallbackKind: "text-list" }] });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("fallback");
  });

  it("retire_presentation moves renderable → retired when the density guard holds", () => {
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    m.render(renderRequestFor(validDraft()));
    const r = m.fire("retire_presentation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("retired");
  });

  it("render_with_capabilities fails with the precise violated semantic aspect", () => {
    const draft = validDraft();
    // changed meaning
    const meaningChanged = validDraft();
    const m1 = createPresentationMachine(meaningChanged);
    m1.fire("validate_presentation");
    const r1 = m1.render({
      actions: [{ actionId: "choose-target", meaning: "something else entirely", responseSchema: [{ name: "target", type: "string" }] }],
    });
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe("host rendering changed the meaning of action choose-target");
    // changed schema
    const m2 = createPresentationMachine(draft);
    m2.fire("validate_presentation");
    const r2 = m2.render({
      actions: [{ actionId: "choose-target", meaning: "select one deployment target", responseSchema: [{ name: "target", type: "number" }] }],
    });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("host rendering changed the response schema of action choose-target");
    // dropped action
    const m3 = createPresentationMachine(draft);
    m3.fire("validate_presentation");
    const r3 = m3.render({ actions: [] });
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe("host rendering drops declared action choose-target");
    // introduced action
    const m4 = createPresentationMachine(draft);
    m4.fire("validate_presentation");
    const r4 = m4.render({
      actions: [
        { actionId: "choose-target", meaning: "select one deployment target", responseSchema: [{ name: "target", type: "string" }] },
        { actionId: "extra", meaning: "undeclared", responseSchema: [] },
      ],
    });
    expect(r4.ok).toBe(false);
    expect(r4.reason).toBe("host rendering introduces undeclared action extra");
  });

  it("use_semantic_fallback fails with the precise fallback violation", () => {
    // undocumented fallback kind
    const m1 = createPresentationMachine(validDraft());
    m1.fire("validate_presentation");
    const r1 = m1.fallback({ nativeActionIds: [], substitutions: [{ actionId: "choose-target", fallbackKind: "carousel" }] });
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe("undocumented fallback kind: carousel");
    // missing substitution for a non-native action
    const m2 = createPresentationMachine(validDraft());
    m2.fire("validate_presentation");
    const r2 = m2.fallback({ nativeActionIds: [], substitutions: [] });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "no documented semantically equivalent fallback for action choose-target; the host must return unsupported",
    );
  });

  it("retire_presentation fails with the precise density violation", () => {
    const big = validDraft({ supportingContext: Array.from({ length: 15 }, (_, i) => `context item ${i}`) });
    const m = createPresentationMachine(big);
    m.fire("validate_presentation");
    m.render(renderRequestFor(big));
    const r = m.fire("retire_presentation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("item count 17 exceeds catalog limit 12");
    expect(m.state).toBe("renderable");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createPresentationMachine(validDraft());
    // retire_presentation starts at renderable, not proposed
    const r = m.fire("retire_presentation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition retire_presentation cannot fire from state proposed");
    expect(m.state).toBe("proposed");
    // reject_presentation is the negated guard: it cannot fire on a valid role
    const r2 = m.fire("reject_presentation");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("reject_presentation requires an unsupported semantic role");
    expect(m.state).toBe("proposed");
  });
});