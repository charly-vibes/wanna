// Purpose: the component-catalog model state machine
// Responsibilities: draft/validated/published/deprecated with the four guarded transitions
// Rationale: [[spec]] ## Model — guards cite schema_mapping_explicit / catalog_version_pinned / catalog_changes_reviewed
import type { Catalog, CatalogState, RecordedTransition, TransitionResult } from "./types";
import { catalogVersionPinned, schemaMappingExplicit } from "./invariants";

export interface CatalogMachineDeps {
  /** Review record available for deprecate_catalog ([[spec.catalog_changes_reviewed]]). */
  readonly review?: string;
}

export interface CatalogMachine {
  readonly state: CatalogState;
  readonly log: readonly RecordedTransition[];
  validateCatalog(): TransitionResult;
  rejectCatalog(): TransitionResult;
  publishCatalog(): TransitionResult;
  deprecateCatalog(): TransitionResult;
}

export function createCatalogMachine(catalog: Catalog, deps: CatalogMachineDeps = {}): CatalogMachine {
  let state: CatalogState = "draft";
  const log: RecordedTransition[] = [];

  function transition(id: RecordedTransition["id"], from: CatalogState, to: CatalogState, guard: () => boolean, guardFailReason: string): TransitionResult {
    if (state !== from) return { ok: false, reason: `${id}: expected state ${from}, found ${state}` };
    if (!guard()) return { ok: false, reason: `${id}: guard failed — ${guardFailReason}` };
    state = to;
    log.push({ id, from, to });
    return { ok: true };
  }

  return {
    get state() {
      return state;
    },
    get log() {
      return log;
    },
    validateCatalog: () =>
      transition("validate_catalog", "draft", "validated", () => schemaMappingExplicit(catalog), "schema_mapping_explicit does not hold"),
    rejectCatalog: () =>
      transition("reject_catalog", "draft", "deprecated", () => !schemaMappingExplicit(catalog), "schema_mapping_explicit holds, nothing to reject"),
    publishCatalog: () =>
      transition("publish_catalog", "validated", "published", () => catalogVersionPinned(catalog), "catalog_version_pinned does not hold"),
    deprecateCatalog: () =>
      transition("deprecate_catalog", "published", "deprecated", () => (deps.review ?? "").trim() !== "", "catalog_changes_reviewed does not hold (no review record)"),
  };
}