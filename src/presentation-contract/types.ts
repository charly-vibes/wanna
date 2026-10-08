// Purpose: vocabulary and record shapes for the presentation-contract layer
// Responsibilities: semantic roles, component-role and fallback catalogs, density catalog, contract/host/view record types, state and transition types
// Rationale: the layer works on typed semantic records, never on host-shaped or executable presentation data
export const SEMANTIC_ROLES = [
  "clarify", "choose", "compare", "edit", "inspect", "verify", "authorize",
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

export const SEMANTIC_COMPONENT_ROLES = [
  "prompt", "choice-list", "comparison-table", "edit-field", "inspect-panel",
  "verify-checklist", "authorize-consent", "action-bar", "detail-disclosure",
  "status-line", "text-block", "metric-badge",
] as const;

export type SemanticComponentRole = (typeof SEMANTIC_COMPONENT_ROLES)[number];

export const FALLBACK_KINDS = [
  "text-list", "inline-question", "plain-summary",
] as const;

export type FallbackKind = (typeof FALLBACK_KINDS)[number];

export const DENSITY_LEVELS = ["minimal", "compact", "comfortable"] as const;

export type DensityLevel = (typeof DENSITY_LEVELS)[number];

export interface CatalogLimits {
  readonly densityLevels: readonly DensityLevel[];
  readonly maxItems: number;
  readonly maxNestingDepth: number;
  readonly maxContentChars: number;
}

export const DENSITY_CATALOG: CatalogLimits = {
  densityLevels: DENSITY_LEVELS,
  maxItems: 12,
  maxNestingDepth: 4,
  maxContentChars: 20000,
};

export interface ResponseField {
  readonly name: string;
  readonly type: string;
}

export interface SemanticAction {
  readonly id: string;
  readonly meaning: string;
  readonly responseSchema: readonly ResponseField[];
}

export interface UncertaintyMetric {
  readonly id: string;
  readonly value: number;
  readonly semantics: string;
  readonly evidenceRefs: readonly string[];
}

export interface PresentationContract {
  readonly role?: string;
  readonly primaryTask?: string;
  readonly supportingContext?: readonly string[];
  readonly optionalDetail?: readonly string[];
  readonly actions?: readonly SemanticAction[];
  readonly components?: readonly string[];
  readonly texts?: readonly string[];
  readonly density?: string;
}

export interface RenderedAction {
  readonly actionId: string;
  readonly meaning: string;
  readonly responseSchema: readonly ResponseField[];
}

export interface RenderedMetric {
  readonly metricId: string;
  readonly value: number;
  readonly forcedAcrossModalities?: boolean;
}

export interface HostRenderRequest {
  readonly actions: readonly RenderedAction[];
  readonly uncertainty?: readonly RenderedMetric[];
}

export interface FallbackSubstitution {
  readonly actionId: string;
  readonly fallbackKind: string;
}

export interface FallbackRequest {
  readonly nativeActionIds: readonly string[];
  readonly substitutions: readonly FallbackSubstitution[];
}

export interface ViewItem {
  readonly id: string;
  readonly content: string;
  readonly children: readonly ViewItem[];
}

export interface PresentationView {
  readonly actions: readonly RenderedAction[];
  readonly inertTexts: readonly string[];
  readonly items: readonly ViewItem[];
  readonly density: string;
  readonly uncertainty: readonly RenderedMetric[];
}

export interface Adaptation {
  readonly reorder?: readonly string[];
  readonly replaceWith?: readonly string[];
  readonly reason?: string;
  readonly safetyCritical?: boolean;
  readonly userAccepted?: boolean;
}

export type PresentationState =
  | "proposed"
  | "validated"
  | "renderable"
  | "fallback"
  | "unsupported"
  | "retired";

export type TransitionId =
  | "validate_presentation"
  | "reject_presentation"
  | "render_with_capabilities"
  | "use_semantic_fallback"
  | "retire_presentation";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };