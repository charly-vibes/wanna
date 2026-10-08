// Purpose: property tests for the accessibility-adaptation layer
// Responsibilities: each corpus property of accessibility-adaptation as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/accessibility-adaptation/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createAccessibilityAdapter } from "../../src/accessibility-adaptation/machine";
import {
  controlsHaveNames,
  documentsEquivalentOperation,
  focusOrderLogical,
  keyboardEquivalent,
  meaningSurvivesAdaptation,
  obligationsDeclared,
  presentationRespectsPreferences,
  statusChangesAnnounced,
} from "../../src/accessibility-adaptation/invariants";
import {
  fullHost,
  muteHost,
  noPreferences,
  reducedMotionPreferences,
  validContract,
} from "./fixtures";

function checkedAdapter(overrides = {}, host = fullHost(), preferences = noPreferences()) {
  const m = createAccessibilityAdapter(validContract(overrides), host, preferences);
  m.fire("check_accessibility");
  return m;
}

function report(m: ReturnType<typeof checkedAdapter>, invariant: string) {
  return m.checkReport!.find((row) => row.invariant === invariant);
}

describe("accessibility-adaptation properties", () => {
  it("TypeScript conformance test: assert invariant controls_have_names at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the check_accessibility gate consumes the invariant
    expect(controlsHaveNames(validContract()).ok).toBe(true);
    expect(checkedAdapter().state).toBe("checked");
    // edge: no programmatic name
    const unnamed = validContract({
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
    expect(controlsHaveNames(unnamed)).toEqual({
      ok: false,
      reason: 'controls_have_names does not hold: control "submit" has no programmatic name',
    });
    // edge: description needed but missing
    const undescribed = validContract({
      controls: [
        {
          id: "pay",
          label: "Pay",
          description: null,
          needsDescription: true,
          errorMessage: null,
          needsErrorAssociation: false,
        },
      ],
    });
    expect(controlsHaveNames(undescribed)).toEqual({
      ok: false,
      reason: 'controls_have_names does not hold: control "pay" requires a description',
    });
    // edge: error association needed but missing
    const unassociated = validContract({
      controls: [
        {
          id: "pay",
          label: "Pay",
          description: "Authorize the charge",
          needsDescription: true,
          errorMessage: null,
          needsErrorAssociation: true,
        },
      ],
    });
    expect(controlsHaveNames(unassociated)).toEqual({
      ok: false,
      reason: 'controls_have_names does not hold: control "pay" requires an associated error message',
    });
    // the gate refuses the unnamed contract at its trust boundary
    expect(checkedAdapter(unnamed).state).toBe("proposed");
  });

  it("TypeScript conformance test: assert invariant keyboard_equivalent at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the use_accessible_fallback guard consumes the invariant
    expect(keyboardEquivalent(validContract(), fullHost()).ok).toBe(true);
    // edge: pointer operation without a keyboard equivalent in a keyboard-capable host
    const noKb = validContract({
      operations: [{ id: "drag-item", pointerTriggered: true, keyboardEquivalent: null }],
    });
    expect(keyboardEquivalent(noKb, fullHost())).toEqual({
      ok: false,
      reason:
        'keyboard_equivalent does not hold: operation "drag-item" has no keyboard equivalent in a keyboard-capable host',
    });
    // edge: the constraint is scoped to hosts that support keyboard input
    expect(keyboardEquivalent(noKb, muteHost()).ok).toBe(true);
    // edge: a pointer-free operation needs no keyboard equivalent
    const pointerFree = validContract({
      operations: [{ id: "autosave", pointerTriggered: false, keyboardEquivalent: null }],
    });
    expect(keyboardEquivalent(pointerFree, fullHost()).ok).toBe(true);
    // the fallback gate refuses the unequivalent contract
    expect(checkedAdapter(noKb).fire("use_accessible_fallback").ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant focus_order_logical at its trust boundary and under its stated edge cases.", () => {
    expect(focusOrderLogical(validContract()).ok).toBe(true);
    // edge: focus follows incidental render order instead of semantic order
    const renderOrder = validContract({
      focusOrder: ["submit-order", "confirm-payment"],
      semanticOrder: ["confirm-payment", "submit-order"],
    });
    expect(focusOrderLogical(renderOrder)).toEqual({
      ok: false,
      reason:
        'focus_order_logical does not hold: focus order ["submit-order", "confirm-payment"] does not follow the task\'s semantic reading and action order ["confirm-payment", "submit-order"]',
    });
    // the machine records the result in its check report
    expect(report(checkedAdapter(renderOrder), "focus_order_logical")!.ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant status_changes_announced at its trust boundary and under its stated edge cases.", () => {
    expect(statusChangesAnnounced(validContract(), fullHost()).ok).toBe(true);
    // edge: an important state change with no announcement mechanism
    const silent = validContract({
      statusEvents: [
        { id: "order-placed", kind: "state_change", announcementMechanism: null },
      ],
    });
    expect(statusChangesAnnounced(silent, fullHost())).toEqual({
      ok: false,
      reason:
        'status_changes_announced does not hold: status event "order-placed" (state_change) has no announcement mechanism',
    });
    // edge: the constraint binds through the host's announcement mechanism
    expect(statusChangesAnnounced(silent, muteHost()).ok).toBe(true);
    // the machine records the result in its check report
    expect(report(checkedAdapter(silent), "status_changes_announced")!.ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant meaning_survives_adaptation at its trust boundary and under its stated edge cases.", () => {
    const contract = validContract();
    // trust boundary: the accept_accessible_render guard consumes the invariant
    expect(meaningSurvivesAdaptation(contract, contract.adaptation).ok).toBe(true);
    // edge: required information removed by the adaptation
    const drops = { ...contract.adaptation, presentedInformation: [] };
    expect(meaningSurvivesAdaptation(contract, drops)).toEqual({
      ok: false,
      reason:
        'meaning_survives_adaptation does not hold: adaptation drops required information: "total price"',
    });
    // edge: required confirmation bypassed
    const bypasses = { ...contract.adaptation, confirmationPreserved: false };
    expect(meaningSurvivesAdaptation(contract, bypasses)).toEqual({
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation bypasses required confirmation",
    });
    // edge: response meaning changed
    const reinterpreted = { ...contract.adaptation, responseMeaningChanged: true };
    expect(meaningSurvivesAdaptation(contract, reinterpreted)).toEqual({
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation changes response meaning",
    });
    // the accept gate refuses each violating adaptation
    for (const plan of [drops, bypasses, reinterpreted]) {
      expect(checkedAdapter({ adaptation: plan }).fire("accept_accessible_render").ok).toBe(false);
    }
  });

  it("TypeScript conformance test: assert invariant motion_and_density_respect_preferences at its trust boundary and under its stated edge cases.", () => {
    const contract = validContract();
    const host = fullHost();
    // no declared preferences: the invariant holds regardless of presentation
    expect(presentationRespectsPreferences(contract, host, noPreferences()).ok).toBe(true);
    // declared reduced-motion honored by the presentation
    expect(presentationRespectsPreferences(contract, host, reducedMotionPreferences()).ok).toBe(true);
    // edge: reduced-motion declared but the presentation uses motion the host can suppress
    const moving = validContract({
      presentation: { usesMotion: true, respectsTextSize: true, respectsDensity: true },
    });
    expect(presentationRespectsPreferences(moving, host, reducedMotionPreferences())).toEqual({
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: reduced-motion preference is declared but the presentation uses motion the host can suppress",
    });
    // edge: the constraint applies only where the host can support the preference
    expect(presentationRespectsPreferences(moving, muteHost(), reducedMotionPreferences()).ok).toBe(
      true,
    );
    // edge: text-size and density preferences ignored by the presentation
    const rigid = validContract({
      presentation: { usesMotion: false, respectsTextSize: false, respectsDensity: false },
    });
    expect(
      presentationRespectsPreferences(rigid, host, { largeText: true, compactDensity: true }),
    ).toEqual({
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: text-size preference is declared but the presentation ignores text-size in a host that can honor it",
    });
    expect(
      presentationRespectsPreferences(
        validContract({
          presentation: { usesMotion: false, respectsTextSize: true, respectsDensity: false },
        }),
        host,
        { compactDensity: true },
      ),
    ).toEqual({
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: density preference is declared but the presentation ignores density in a host that can honor it",
    });
    // the machine records the result in its check report
    expect(
      report(
        checkedAdapter(moving, fullHost(), reducedMotionPreferences()),
        "motion_and_density_respect_preferences",
      )!.ok,
    ).toBe(false);
  });

  it("TypeScript conformance test: assert invariant inaccessible_interaction_not_silently_rendered at its trust boundary and under its stated edge cases.", () => {
    // no keyboard support, no announcements, and an adaptation that drops
    // required information: no accessible equivalent exists
    const unequivalent = {
      adaptation: {
        presentedInformation: [],
        confirmationPreserved: true,
        responseMeaningChanged: false,
        documentedEquivalent: null,
      },
    };
    const m = checkedAdapter(unequivalent, muteHost());
    // every render path is guarded: the adapter cannot silently render
    expect(m.fire("accept_accessible_render").ok).toBe(false);
    expect(m.fire("use_accessible_fallback").ok).toBe(false);
    // the inaccessible interaction produces an explicit unsupported result
    expect(m.fire("reject_inaccessible_render").ok).toBe(true);
    expect(m.state).toBe("unsupported");
    expect(m.unsupportedReason).toBe(
      'interaction "checkout-confirm" has no accessible equivalent for the declared host capabilities and preferences — the interaction is unsupported',
    );
    // edge: when an equivalent exists, the interaction is never reported unsupported
    const equivalent = checkedAdapter();
    expect(equivalent.fire("reject_inaccessible_render").ok).toBe(false);
    expect(equivalent.fire("accept_accessible_render").ok).toBe(true);
    expect(equivalent.state).toBe("accessible");
  });

  it("Schema test: interaction contract declares obligations consumed by adapters", () => {
    // a well-formed contract declares semantic obligations before host rendering
    expect(obligationsDeclared(validContract()).ok).toBe(true);
    // edge: a contract with no obligations is not adaptable
    const bare = validContract({ obligations: [] });
    expect(obligationsDeclared(bare)).toEqual({
      ok: false,
      reason:
        'accessibility_obligations_semantic does not hold: contract "checkout-confirm" declares no semantic accessibility obligations',
    });
    // edge: every semantic element must be covered by a declared obligation
    const uncovered = validContract({
      obligations: [{ id: "ob-name-pay", kind: "name", targetId: "confirm-payment" }],
    });
    expect(obligationsDeclared(uncovered)).toEqual({
      ok: false,
      reason:
        'accessibility_obligations_semantic does not hold: operation "submit-order" has no declared accessibility obligation',
    });
    // adapters consume the declared obligations: the machine's check report is
    // computed from the contract, not from post-render host state
    const m = checkedAdapter();
    const row = report(m, "accessibility_obligations_semantic")!;
    expect(row.ok).toBe(true);
    // the report exists before any render decision is taken
    expect(m.state).toBe("checked");
    expect(m.checkReport!.length).toBeGreaterThan(0);
  });

  it("when exact visual behavior cannot transfer across hosts, the adapter documents a semantically equivalent accessible operation or reports unsupported", () => {
    // trust boundary: the adapter consumes documentsEquivalentOperation on the fallback path
    expect(documentsEquivalentOperation(validContract()).ok).toBe(true);
    // path 1: visual behavior cannot transfer, but a documented equivalent
    // operation exists — the adapter takes the fallback, never the direct render
    const transferable = checkedAdapter({
      adaptation: {
        presentedInformation: ["total price"],
        confirmationPreserved: true,
        responseMeaningChanged: false,
        documentedEquivalent:
          "keyboard: press Enter on the focused order summary row to submit the order",
      },
    });
    const fallback = transferable.fire("use_accessible_fallback");
    expect(fallback).toEqual({ ok: true });
    expect(transferable.state).toBe("fallback");
    // path 2: no equivalent operation is documentable — the adapter reports
    // unsupported explicitly rather than rendering an unusable control
    expect(documentsEquivalentOperation(
      validContract({
        adaptation: {
          presentedInformation: ["total price"],
          confirmationPreserved: true,
          responseMeaningChanged: false,
          documentedEquivalent: null,
        },
      }),
    )).toEqual({
      ok: false,
      reason:
        'modality_equivalence_explicit does not hold: adaptation for "checkout-confirm" documents no semantically equivalent accessible operation',
    });
    const noEquivalent = checkedAdapter(
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
    expect(noEquivalent.fire("reject_inaccessible_render").ok).toBe(true);
    expect(noEquivalent.state).toBe("unsupported");
    expect(noEquivalent.unsupportedReason).not.toBeNull();
  });
});
