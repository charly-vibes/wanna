// Purpose: the component-catalog model state machine
// Responsibilities: draft/validated/published/deprecated with the four guarded transitions
// Rationale: transitions are table-driven, mirroring [[spec]] ## Model row for row
import type { Catalog, CatalogState, RecordedTransition, TransitionId, TransitionResult } from "./types";
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

/** One row per [[spec]] ## Model transition: id, from, to, guard. */
type TransitionRow = {
  readonly id: TransitionId;
  readonly from: CatalogState;
  readonly to: CatalogState;
  readonly guard: (catalog: Catalog, deps: CatalogMachineDeps) => boolean;
  readonly guardFailReason: string;
};

function transitionTable(): Record<TransitionId, TransitionRow> {
  const row = (
    id: TransitionId,
    from: CatalogState,
    to: CatalogState,
    guard: TransitionRow["guard"],
    guardFailReason: string,
  ): TransitionRow => ({ id, from, to, guard, guardFailReason });
  const table = {
    validate_catalog: row("validate_catalog", "draft", "validated", (c) => schemaMappingExplicit(c), "schema_mapping_explicit does not hold"),
    reject_catalog: row("reject_catalog", "draft", "deprecated", (c) => !schemaMappingExplicit(c), "schema_mapping_explicit holds, nothing to reject"),
    publish_catalog: row("publish_catalog", "validated", "published", (c) => catalogVersionPinned(c), "catalog_version_pinned does not hold"),
    deprecate_catalog: row("deprecate_catalog", "published", "deprecated", (_c, d) => (d.review ?? "").trim() !== "", "catalog_changes_reviewed does not hold (no review record)"),
  };
  return table;
}

export function createCatalogMachine(catalog: Catalog, deps: CatalogMachineDeps = {}): CatalogMachine {
  let state: CatalogState = "draft";
  const log: RecordedTransition[] = [];
  const table = transitionTable();

  function fire(id: TransitionId): TransitionResult {
    const row = table[id];
    if (state !== row.from) return { ok: false, reason: `${id}: expected state ${row.from}, found ${state}` };
    if (!row.guard(catalog, deps)) return { ok: false, reason: `${id}: guard failed — ${row.guardFailReason}` };
    state = row.to;
    log.push({ id: row.id, from: row.from, to: row.to });
    return { ok: true };
  }

  return {
    get state() {
      return state;
    },
    get log() {
      return log;
    },
    validateCatalog: () => fire("validate_catalog"),
    rejectCatalog: () => fire("reject_catalog"),
    publishCatalog: () => fire("publish_catalog"),
    deprecateCatalog: () => fire("deprecate_catalog"),
  };
}