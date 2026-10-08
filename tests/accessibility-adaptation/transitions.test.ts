// Purpose: transition tests for the accessibility-adaptation model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: the machine must mirror the spec's Model table row for row; loose reason assertions let real bypasses through
import { describe, it, expect } from "vitest";
import { createAccessibilityAdapter } from "../../src/accessibility-adaptation/machine";
import { fullHost, muteHost, noPreferences, validContract } from "./fixtures";

function adapter(
  overrides: Parameters<typeof validContract>[0] = {},
  host = fullHost(),
) {
  return createAccessibilityAdapter(validContract(overrides), host, noPreferences());
}

function checked(overrides: Parameters<typeof validContract>[0] = {}, host = fullHost()) {
  const m = adapter(overrides, host);
  m.fire("check_accessibility");
  return m;
}

describe("accessibility-adaptation transitions", () => {
  it("check_accessibility moves proposed → checked when controls_have_names holds", () => {
    const m = adapter();
    expect(m.state).toBe("proposed");
    const r = m.fire("check_accessibility");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("checked");
    // the check records the full invariant battery consumed from the contract
    expect(m.checkReport).not.toBeNull();
    expect(m.checkReport!.map((row) => row.invariant)).toContain("controls_have_names");
  });

  it("check_accessibility refuses when a control has no programmatic name, with the exact reason", () => {
    const m = adapter({
      controls: [
        {
          id: "submit",
          label: null,
          description: null,
          needsDescription: false,
          errorMessage: null,
          needsErrorAssociation: false,
        },
      ],
    });
    const r = m.fire("check_accessibility");
    expect(r).toEqual({
      ok: false,
      reason: 'controls_have_names does not hold: control "submit" has no programmatic name',
    });
    expect(m.state).toBe("proposed");
  });

  it("accept_accessible_render moves checked → accessible when meaning_survives_adaptation holds", () => {
    const m = checked();
    const r = m.fire("accept_accessible_render");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("accessible");
  });

  it("accept_accessible_render refuses with the exact reason when the adaptation drops required information", () => {
    const m = checked({
      adaptation: {
        presentedInformation: [],
        confirmationPreserved: true,
        responseMeaningChanged: false,
        documentedEquivalent: null,
      },
    });
    const r = m.fire("accept_accessible_render");
    expect(r).toEqual({
      ok: false,
      reason: 'meaning_survives_adaptation does not hold: adaptation drops required information: "total price"',
    });
    expect(m.state).toBe("checked");
  });

  it("accept_accessible_render refuses with the exact reason when the adaptation bypasses required confirmation", () => {
    const m = checked({
      adaptation: {
        presentedInformation: ["total price"],
        confirmationPreserved: false,
        responseMeaningChanged: false,
        documentedEquivalent: null,
      },
    });
    const r = m.fire("accept_accessible_render");
    expect(r).toEqual({
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation bypasses required confirmation",
    });
  });

  it("accept_accessible_render refuses with the exact reason when the adaptation changes response meaning", () => {
    const m = checked({
      adaptation: {
        presentedInformation: ["total price"],
        confirmationPreserved: true,
        responseMeaningChanged: true,
        documentedEquivalent: null,
      },
    });
    const r = m.fire("accept_accessible_render");
    expect(r).toEqual({
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation changes response meaning",
    });
  });

  it("use_accessible_fallback moves checked → fallback when keyboard_equivalent holds and an equivalent operation is documented", () => {
    const m = checked();
    const r = m.fire("use_accessible_fallback");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("fallback");
  });

  it("use_accessible_fallback refuses with the exact reason when a pointer operation has no keyboard equivalent", () => {
    const m = checked({
      operations: [{ id: "submit-order", pointerTriggered: true, keyboardEquivalent: null }],
    });
    const r = m.fire("use_accessible_fallback");
    expect(r).toEqual({
      ok: false,
      reason:
        'keyboard_equivalent does not hold: operation "submit-order" has no keyboard equivalent in a keyboard-capable host',
    });
    expect(m.state).toBe("checked");
  });

  it("use_accessible_fallback refuses with the exact reason when the host does not support keyboard input", () => {
    const m = checked({}, muteHost());
    const r = m.fire("use_accessible_fallback");
    expect(r).toEqual({
      ok: false,
      reason:
        "keyboard_equivalent does not hold: the host does not support keyboard input, so no keyboard fallback can be documented",
    });
  });

  it("use_accessible_fallback refuses with the exact reason when no semantically equivalent accessible operation is documented", () => {
    const m = checked({
      adaptation: {
        presentedInformation: ["total price"],
        confirmationPreserved: true,
        responseMeaningChanged: false,
        documentedEquivalent: null,
      },
    });
    const r = m.fire("use_accessible_fallback");
    expect(r).toEqual({
      ok: false,
      reason:
        'modality_equivalence_explicit does not hold: adaptation for "checkout-confirm" documents no semantically equivalent accessible operation',
    });
  });

  it("reject_inaccessible_render moves checked → unsupported with an explicit reason when no accessible equivalent exists", () => {
    // no keyboard support, no announcements, and the adaptation drops required
    // information: accept and fallback are both unavailable by construction
    const m = checked(
      {
        adaptation: {
          presentedInformation: [],
          confirmationPreserved: true,
          responseMeaningChanged: false,
          documentedEquivalent: null,
        },
      },
      muteHost(),
    );
    expect(m.fire("accept_accessible_render").ok).toBe(false);
    expect(m.fire("use_accessible_fallback").ok).toBe(false);
    const r = m.fire("reject_inaccessible_render");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("unsupported");
    expect(m.unsupportedReason).toBe(
      'interaction "checkout-confirm" has no accessible equivalent for the declared host capabilities and preferences — the interaction is unsupported',
    );
  });

  it("reject_inaccessible_render refuses with the exact reason when an accessible equivalent exists", () => {
    const m = checked();
    const r = m.fire("reject_inaccessible_render");
    expect(r).toEqual({
      ok: false,
      reason:
        'reject_inaccessible_render refused: interaction "checkout-confirm" has an accessible equivalent — accept the accessible render or use the documented fallback',
    });
    expect(m.state).toBe("checked");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = adapter();
    expect(m.fire("accept_accessible_render")).toEqual({
      ok: false,
      reason: "transition accept_accessible_render cannot fire from state proposed",
    });
    m.fire("check_accessibility");
    expect(m.fire("check_accessibility")).toEqual({
      ok: false,
      reason: "transition check_accessibility cannot fire from state checked",
    });
  });
});
