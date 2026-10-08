// Purpose: public surface of the presentation-contract layer
// Responsibilities: re-export the machine, types, invariants, rendering and stability checks under one entry point
// Rationale: callers import from the capability, never from internals
export { createPresentationMachine, PRESENTATION_TRANSITIONS } from "./machine";
export type { PresentationMachine, TransitionRow } from "./machine";
export {
  DENSITY_CATALOG,
  DENSITY_LEVELS,
  FALLBACK_KINDS,
  MARKUP_SIGNATURES,
  SEMANTIC_COMPONENT_ROLES,
  SEMANTIC_ROLES,
  contentHierarchyExplicit,
  densityBounded,
  hostComponentNamesForbidden,
  semanticRoleRequired,
  untrustedTextInert,
} from "./invariants";
export type { Check } from "./invariants";
export {
  fallbackIsSemantic,
  responseSemanticsPreserved,
  uncertaintySemanticsPreserved,
} from "./rendering";
export {
  activeInteractionStable,
  adaptationReasonAvailable,
  isMaterialChange,
  revertPermitted,
} from "./stability";
export { buildView } from "./view";
export type {
  Adaptation,
  CatalogLimits,
  DensityLevel,
  FallbackKind,
  FallbackRequest,
  FallbackSubstitution,
  HostRenderRequest,
  PresentationContract,
  PresentationState,
  PresentationView,
  RenderedAction,
  RenderedMetric,
  ResponseField,
  SemanticAction,
  SemanticComponentRole,
  SemanticRole,
  TransitionId,
  TransitionResult,
  UncertaintyMetric,
  ViewItem,
} from "./types";