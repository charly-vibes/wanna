// Purpose: vocabulary and record shapes for the interaction-catalog layer
// Responsibilities: interaction kinds, catalog definitions, mappings, states, transition ids, authorize contracts
// Rationale: the catalog is closed, versioned data — every record is readonly and every vocabulary a closed union
export const INTERACTION_KINDS = [
  "clarify", "choose", "rank", "configure",
  "review", "diagnose", "verify", "authorize",
] as const;

export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export interface KindBounds {
  readonly maxOptions?: number;
  readonly maxFields?: number;
  readonly maxPayloadBytes: number;
  readonly maxStringLength: number;
  readonly maxNesting: number;
}

export interface KindDefinition {
  readonly kind: InteractionKind;
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
  readonly outcomes: readonly string[];
  readonly bounds: KindBounds;
  readonly renderer: string;
}

export interface KindMapping {
  readonly needKind: string;
  readonly primary: InteractionKind | null;
  readonly alternatives: readonly InteractionKind[];
}

export interface CatalogDefinition {
  readonly version: string;
  readonly kinds: readonly KindDefinition[];
  readonly mappings: readonly KindMapping[];
}

export interface OptionSpec {
  readonly id: string;
  readonly label: string;
}

export interface ResponseRecord {
  readonly kind: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export type CatalogState =
  | "draft"
  | "validated"
  | "invalid"
  | "published"
  | "retired";

export type CatalogTransitionId =
  | "validate_catalog"
  | "reject_invalid_catalog"
  | "correct_catalog"
  | "publish_pinned_catalog"
  | "retire_catalog_version";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export type Check = { ok: true } | { ok: false; reason: string };

export interface CompatibilityReview {
  readonly reviewer: string;
  readonly approved: boolean;
}

export interface RetirementAction {
  readonly reason: string;
  readonly migration?: string;
  readonly reissueVersion?: string;
}

export interface TransitionPayload {
  readonly nextDefinition?: CatalogDefinition;
  readonly review?: CompatibilityReview;
  readonly retirement?: RetirementAction;
}

export interface AuthorizeContractInput {
  readonly action: string;
  readonly scope: string;
  readonly taskRevision: string;
  readonly actor: string;
  readonly expiry: string;
  readonly policyContext: string;
}

export interface AuthorizeContract extends AuthorizeContractInput {
  readonly bindingHash: string;
}

export interface AuthorizeDecisionInput {
  readonly action: string;
  readonly taskRevision: string;
  readonly actor: string;
  readonly expiry: string;
}

export type KindResolution =
  | { ok: true; kind: InteractionKind }
  | { ok: false; outcome: "no_eligible_interaction" };

export type MigrateResult =
  | { ok: true; version: string }
  | { ok: false; reason: string };

export interface AgentCatalogProposal {
  readonly addKind?: unknown;
  readonly renameKind?: unknown;
  readonly setMapping?: unknown;
}