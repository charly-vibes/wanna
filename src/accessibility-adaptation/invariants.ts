// Purpose: invariants for the accessibility-adaptation adapter
// Responsibilities: the nine spec invariants as precise check functions, each returning an exact failure reason
// Rationale: each invariant returns a precise failure reason so negative tests can assert it exactly
import type {
  AccessibilityPreferences,
  AdaptationPlan,
  HostCapabilities,
  InteractionContract,
} from "./types";

export type Check =
  | { readonly ok: true; readonly reason?: undefined }
  | { readonly ok: false; readonly reason: string };

export function quote(id: string): string {
  return `"${id}"`;
}

function missing(value: string | null): boolean {
  return value === null || value.length === 0;
}

export function controlsHaveNames(contract: InteractionContract): Check {
  for (const control of contract.controls) {
    if (missing(control.label)) {
      return {
        ok: false,
        reason: `controls_have_names does not hold: control ${quote(control.id)} has no programmatic name`,
      };
    }
    if (control.needsDescription && missing(control.description)) {
      return {
        ok: false,
        reason: `controls_have_names does not hold: control ${quote(control.id)} requires a description`,
      };
    }
    if (control.needsErrorAssociation && missing(control.errorMessage)) {
      return {
        ok: false,
        reason: `controls_have_names does not hold: control ${quote(control.id)} requires an associated error message`,
      };
    }
  }
  return { ok: true };
}

export function keyboardEquivalent(contract: InteractionContract, host: HostCapabilities): Check {
  // the invariant is scoped to hosts that support keyboard input
  if (!host.supportsKeyboard) return { ok: true };
  for (const operation of contract.operations) {
    if (operation.pointerTriggered && missing(operation.keyboardEquivalent)) {
      return {
        ok: false,
        reason: `keyboard_equivalent does not hold: operation ${quote(operation.id)} has no keyboard equivalent in a keyboard-capable host`,
      };
    }
  }
  return { ok: true };
}

function sequenceLabel(ids: readonly string[]): string {
  return `[${ids.map((id) => quote(id)).join(", ")}]`;
}

export function focusOrderLogical(contract: InteractionContract): Check {
  const matches =
    contract.focusOrder.length === contract.semanticOrder.length &&
    contract.focusOrder.every((id, index) => id === contract.semanticOrder[index]);
  if (matches) return { ok: true };
  return {
    ok: false,
    reason: `focus_order_logical does not hold: focus order ${sequenceLabel(contract.focusOrder)} does not follow the task's semantic reading and action order ${sequenceLabel(contract.semanticOrder)}`,
  };
}

export function statusChangesAnnounced(
  contract: InteractionContract,
  host: HostCapabilities,
): Check {
  if (!host.supportsStatusAnnouncements) return { ok: true };
  for (const event of contract.statusEvents) {
    if (missing(event.announcementMechanism)) {
      return {
        ok: false,
        reason: `status_changes_announced does not hold: status event ${quote(event.id)} (${event.kind}) has no announcement mechanism`,
      };
    }
  }
  return { ok: true };
}

export function meaningSurvivesAdaptation(
  contract: InteractionContract,
  plan: AdaptationPlan,
): Check {
  const dropped = contract.requiredInformation.filter(
    (info) => !plan.presentedInformation.includes(info),
  );
  if (dropped.length > 0) {
    return {
      ok: false,
      reason: `meaning_survives_adaptation does not hold: adaptation drops required information: ${dropped.map(quote).join(", ")}`,
    };
  }
  if (contract.requiresConfirmation && !plan.confirmationPreserved) {
    return {
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation bypasses required confirmation",
    };
  }
  if (plan.responseMeaningChanged) {
    return {
      ok: false,
      reason: "meaning_survives_adaptation does not hold: adaptation changes response meaning",
    };
  }
  return { ok: true };
}

export function presentationRespectsPreferences(
  contract: InteractionContract,
  host: HostCapabilities,
  preferences: AccessibilityPreferences,
): Check {
  const presentation = contract.presentation;
  if (preferences.reducedMotion === true && host.supportsReducedMotion && presentation.usesMotion) {
    return {
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: reduced-motion preference is declared but the presentation uses motion the host can suppress",
    };
  }
  if (preferences.largeText === true && host.supportsTextSize && !presentation.respectsTextSize) {
    return {
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: text-size preference is declared but the presentation ignores text-size in a host that can honor it",
    };
  }
  if (preferences.compactDensity === true && host.supportsDensity && !presentation.respectsDensity) {
    return {
      ok: false,
      reason:
        "motion_and_density_respect_preferences does not hold: density preference is declared but the presentation ignores density in a host that can honor it",
    };
  }
  return { ok: true };
}

export function obligationsDeclared(contract: InteractionContract): Check {
  if (contract.obligations.length === 0) {
    return {
      ok: false,
      reason: `accessibility_obligations_semantic does not hold: contract ${quote(contract.contractId)} declares no semantic accessibility obligations`,
    };
  }
  const covered = new Set(contract.obligations.map((obligation) => obligation.targetId));
  for (const control of contract.controls) {
    if (!covered.has(control.id)) {
      return {
        ok: false,
        reason: `accessibility_obligations_semantic does not hold: control ${quote(control.id)} has no declared accessibility obligation`,
      };
    }
  }
  for (const operation of contract.operations) {
    if (!covered.has(operation.id)) {
      return {
        ok: false,
        reason: `accessibility_obligations_semantic does not hold: operation ${quote(operation.id)} has no declared accessibility obligation`,
      };
    }
  }
  for (const event of contract.statusEvents) {
    if (!covered.has(event.id)) {
      return {
        ok: false,
        reason: `accessibility_obligations_semantic does not hold: status event ${quote(event.id)} has no declared accessibility obligation`,
      };
    }
  }
  return { ok: true };
}

export function documentsEquivalentOperation(contract: InteractionContract): Check {
  if (missing(contract.adaptation.documentedEquivalent)) {
    return {
      ok: false,
      reason: `modality_equivalence_explicit does not hold: adaptation for ${quote(contract.contractId)} documents no semantically equivalent accessible operation`,
    };
  }
  return { ok: true };
}
