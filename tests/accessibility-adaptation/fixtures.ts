// Purpose: test fixtures for the accessibility-adaptation layer
// Responsibilities: build canonical valid contracts, host capabilities, and preferences plus the invalid variants the corpus properties name
// Rationale: single source of shared accessibility vocabulary for transitions and properties tests
import type {
  AccessibilityPreferences,
  HostCapabilities,
  InteractionContract,
} from "../../src/accessibility-adaptation/types";

function hostWith(flags: HostCapabilities): HostCapabilities {
  return {
    supportsKeyboard: flags.supportsKeyboard,
    supportsStatusAnnouncements: flags.supportsStatusAnnouncements,
    supportsReducedMotion: flags.supportsReducedMotion,
    supportsTextSize: flags.supportsTextSize,
    supportsDensity: flags.supportsDensity,
  };
}

export function fullHost(): HostCapabilities {
  return hostWith({
    supportsKeyboard: true,
    supportsStatusAnnouncements: true,
    supportsReducedMotion: true,
    supportsTextSize: true,
    supportsDensity: true,
  });
}

export function muteHost(): HostCapabilities {
  return hostWith({
    supportsKeyboard: false,
    supportsStatusAnnouncements: false,
    supportsReducedMotion: false,
    supportsTextSize: false,
    supportsDensity: false,
  });
}

function preferencesWith(prefs: AccessibilityPreferences): AccessibilityPreferences {
  return Object.assign({}, prefs);
}

export function noPreferences(): AccessibilityPreferences {
  return preferencesWith({});
}

export function reducedMotionPreferences(): AccessibilityPreferences {
  return preferencesWith({ reducedMotion: true });
}

export function validContract(overrides: Partial<InteractionContract> = {}): InteractionContract {
  return {
    contractId: "checkout-confirm",
    obligations: [
      { id: "ob-name-pay", kind: "name", targetId: "confirm-payment" },
      { id: "ob-kb-submit", kind: "keyboard", targetId: "submit-order" },
      { id: "ob-announce-placed", kind: "announcement", targetId: "order-placed" },
    ],
    controls: [
      {
        id: "confirm-payment",
        label: "Confirm payment",
        description: null,
        needsDescription: false,
        errorMessage: null,
        needsErrorAssociation: false,
      },
    ],
    operations: [
      { id: "submit-order", pointerTriggered: true, keyboardEquivalent: "Enter" },
    ],
    statusEvents: [
      { id: "order-placed", kind: "async_completion", announcementMechanism: "aria-live=polite" },
    ],
    requiredInformation: ["total price"],
    requiresConfirmation: true,
    focusOrder: ["confirm-payment", "submit-order"],
    semanticOrder: ["confirm-payment", "submit-order"],
    presentation: { usesMotion: false, respectsTextSize: true, respectsDensity: true },
    adaptation: {
      presentedInformation: ["total price"],
      confirmationPreserved: true,
      responseMeaningChanged: false,
      documentedEquivalent:
        "keyboard: press Enter on the focused order summary row to submit the order",
    },
    ...overrides,
  };
}
