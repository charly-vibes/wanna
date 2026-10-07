// Purpose: reviewed-change entry point for catalog registration/removal
// Responsibilities: every mutation is a versioned trusted change with a review record
// Rationale: [[spec.catalog_changes_reviewed]] — no model-controlled runtime mutation
import type { Catalog, CatalogChange, ReviewRecord } from "./types";

export function applyReviewedChange(catalog: Catalog, requested: ReviewRecord & { change: CatalogChange }): Catalog {
  if (requested.review.trim() === "") {
    throw new Error(`catalog change to ${requested.change.kind} refused: no review record`);
  }
  const change = requested.change;
  const entries =
    change.kind === "register"
      ? [...catalog.entries, change.entry]
      : catalog.entries.filter((e) => e.role !== change.role);
  return { ...catalog, version: `${catalog.version}+${requested.review}`, entries };
}