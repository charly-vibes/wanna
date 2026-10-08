// Purpose: vocabulary and record shapes for the accessibility-adaptation layer
// Responsibilities: interaction contracts, controls, operations, status events, obligations, host capabilities, preferences, adaptation plans, state and transition types
// Rationale: adaptation works on typed semantic records declared before host rendering, never on rendered host widgets
export interface ControlSpec {
  readonly id: string;
  readonly label: string | null;
  readonly description: string | null;
  readonly needsDescription: boolean;
  readonly errorMessage: string | null;
  readonly needsErrorAssociation: boolean;
}

export interface OperationSpec {
  readonly id: string;
  readonly pointerTriggered: boolean;
  readonly keyboardEquivalent: string | null;
}

export type StatusEventKind = "async_completion" | "validation_error" | "state_change";

export interface StatusEventSpec {
  readonly id: string;
  readonly kind: StatusEventKind;
  readonly announcementMechanism: string | null;
}

export type ObligationKind =
  | "name"
  | "description"
  | "error_association"
  | "keyboard"
  | "focus"
  | "announcement"
  | "meaning"
  | "preference";

export interface ObligationSpec {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly targetId: string;
}

export interface PresentationSpec {
  readonly usesMotion: boolean;
  readonly respectsTextSize: boolean;
  readonly respectsDensity: boolean;
}

export interface HostCapabilities {
  readonly supportsKeyboard: boolean;
  readonly supportsStatusAnnouncements: boolean;
  readonly supportsReducedMotion: boolean;
  readonly supportsTextSize: boolean;
  readonly supportsDensity: boolean;
}

export interface AccessibilityPreferences {
  readonly reducedMotion?: boolean;
  readonly largeText?: boolean;
  readonly compactDensity?: boolean;
}

export interface AdaptationPlan {
  readonly presentedInformation: readonly string[];
  readonly confirmationPreserved: boolean;
  readonly responseMeaningChanged: boolean;
  readonly documentedEquivalent: string | null;
}

export interface InteractionContract {
  readonly contractId: string;
  readonly obligations: readonly ObligationSpec[];
  readonly controls: readonly ControlSpec[];
  readonly operations: readonly OperationSpec[];
  readonly statusEvents: readonly StatusEventSpec[];
  readonly requiredInformation: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly focusOrder: readonly string[];
  readonly semanticOrder: readonly string[];
  readonly presentation: PresentationSpec;
  readonly adaptation: AdaptationPlan;
}

export type AccessibilityState =
  | "proposed"
  | "checked"
  | "accessible"
  | "fallback"
  | "unsupported";

export type TransitionId =
  | "check_accessibility"
  | "accept_accessible_render"
  | "use_accessible_fallback"
  | "reject_inaccessible_render";

export type TransitionResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

export type InvariantName =
  | "controls_have_names"
  | "keyboard_equivalent"
  | "focus_order_logical"
  | "status_changes_announced"
  | "meaning_survives_adaptation"
  | "motion_and_density_respect_preferences"
  | "inaccessible_interaction_not_silently_rendered"
  | "accessibility_obligations_semantic"
  | "modality_equivalence_explicit";

export interface InvariantReport {
  readonly invariant: InvariantName;
  readonly ok: boolean;
  readonly reason?: string;
}
