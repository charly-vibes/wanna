// Purpose: domain types for the Trusted Component Catalog
// Responsibilities: the vocabulary shared by invariants, machine, and render
// Rationale: typed per [[spec.schema_mapping_explicit]] and host declarations
export type RoleId = string;

export interface TypedSchema {
  readonly input: string;
  readonly response: string;
  readonly events: readonly string[];
}

export interface CatalogEntry {
  readonly role: RoleId;
  readonly schema: TypedSchema;
  /** Terminates in a registered role id or the literal "unsupported". */
  readonly fallback?: RoleId | "unsupported";
}

export interface Limits {
  readonly maxPayloadBytes: number;
  readonly maxRoles: number;
}

export interface HostDeclaration {
  readonly host: string;
  readonly roles: readonly RoleId[];
  readonly limits: Limits;
}

export interface Catalog {
  /** Immutable pinned version, e.g. "cat-2026.10.1". */
  readonly version: string;
  readonly entries: readonly CatalogEntry[];
  readonly hosts: readonly HostDeclaration[];
}

export type GlobalLimits = Limits;

export interface ReviewRecord {
  readonly review: string;
}

export type CatalogChange =
  | { readonly kind: "register"; readonly entry: CatalogEntry }
  | { readonly kind: "remove"; readonly role: RoleId };

export type CatalogState = "draft" | "validated" | "published" | "deprecated";

export type TransitionId =
  | "validate_catalog"
  | "reject_catalog"
  | "publish_catalog"
  | "deprecate_catalog";

export interface RecordedTransition {
  readonly id: TransitionId;
  readonly from: CatalogState;
  readonly to: CatalogState;
}

export type TransitionResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };