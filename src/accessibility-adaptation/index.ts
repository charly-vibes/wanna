// Purpose: public surface of the accessibility-adaptation layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export {
  ADAPTER_TRANSITIONS,
  ADAPTER_VERSION,
  createAccessibilityAdapter,
} from "./machine";
export type { AccessibilityAdapter, TransitionRow } from "./machine";
export {
  controlsHaveNames,
  documentsEquivalentOperation,
  focusOrderLogical,
  keyboardEquivalent,
  meaningSurvivesAdaptation,
  obligationsDeclared,
  presentationRespectsPreferences,
  statusChangesAnnounced,
} from "./invariants";
export type { Check } from "./invariants";
export type {
  AccessibilityPreferences,
  AccessibilityState,
  AdaptationPlan,
  ControlSpec,
  HostCapabilities,
  InteractionContract,
  InvariantName,
  InvariantReport,
  ObligationKind,
  ObligationSpec,
  OperationSpec,
  PresentationSpec,
  StatusEventKind,
  StatusEventSpec,
  TransitionId,
  TransitionResult,
} from "./types";
