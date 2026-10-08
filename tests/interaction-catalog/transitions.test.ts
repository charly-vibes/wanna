// Purpose: transition tests for the interaction-catalog model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact guard reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise, non-maskable reasons
import { describe, it, expect } from "vitest";
import { createCatalogMachine, contentHash } from "../../src/interaction-catalog/machine";
import {
  V1,
  approvedReview,
  reissueRetirement,
  rejectedReview,
  v1Catalog,
  withoutKind,
  withoutBounds,
} from "./fixtures";
import type { CatalogDefinition } from "../../src/interaction-catalog/types";

const PINNED_V1 = `catalog_kind_set_pinned does not hold: version "${V1}" pins a different kind set; adding, removing, or renaming kinds requires a new catalog version and compatibility review`;

describe("interaction-catalog transitions", () => {
  it("validate_catalog moves draft → validated when kind_response_schema_defined holds", () => {
    const m = createCatalogMachine(v1Catalog());
    expect(m.state).toBe("draft");
    const r = m.fire("validate_catalog");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("validated");
  });

  it("reject_invalid_catalog moves draft → invalid when the schema guard fails, recording the precise reason", () => {
    // removing a kind without a catalog version change violates catalog_kind_set_pinned
    const invalid = withoutKind(v1Catalog(), "verify") as CatalogDefinition;
    const m = createCatalogMachine(invalid);
    const r = m.fire("reject_invalid_catalog");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("invalid");
    expect(m.rejectionReason).toBe(PINNED_V1);
  });

  it("reject_invalid_catalog refuses to fire on a schema-valid catalog", () => {
    const m = createCatalogMachine(v1Catalog());
    const r = m.fire("reject_invalid_catalog");
    expect(r).toEqual({ ok: false, reason: "reject_invalid_catalog requires an invalid catalog" });
    expect(m.state).toBe("draft");
  });

  it("correct_catalog moves invalid → draft only when a corrected definition is supplied", () => {
    const m = createCatalogMachine(withoutBounds(v1Catalog(), "choose"));
    m.fire("reject_invalid_catalog");
    expect(m.state).toBe("invalid");
    // no correction supplied — the guard must refuse
    expect(m.fire("correct_catalog")).toEqual({
      ok: false,
      reason: "corrected_catalog_received does not hold: no corrected catalog definition supplied",
    });
    expect(m.state).toBe("invalid");
    // a corrected definition arrives — the guard holds
    const r = m.fire("correct_catalog", { nextDefinition: v1Catalog() });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("draft");
    expect(m.definition).toEqual(v1Catalog());
  });

  it("publish_pinned_catalog moves validated → published when publication_approved_and_versioned holds", () => {
    const def = v1Catalog();
    const m = createCatalogMachine(def);
    m.fire("validate_catalog");
    const r = m.fire("publish_pinned_catalog", { review: approvedReview() });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("published");
    expect(m.publishedHash).toBe(contentHash(def));
  });

  it("publish_pinned_catalog fails without an approved compatibility review, naming the exact reason", () => {
    const m = createCatalogMachine(v1Catalog());
    m.fire("validate_catalog");
    expect(m.fire("publish_pinned_catalog")).toEqual({
      ok: false,
      reason: "publication_approved_and_versioned does not hold: no compatibility review recorded",
    });
    expect(m.state).toBe("validated");
    expect(m.fire("publish_pinned_catalog", { review: rejectedReview() })).toEqual({
      ok: false,
      reason: "publication_approved_and_versioned does not hold: compatibility review was not approved",
    });
  });

  it("publish_pinned_catalog fails without an immutable version identifier", () => {
    const def = { ...v1Catalog(), version: "interaction-catalog-dev-draft" };
    const m = createCatalogMachine(def);
    m.fire("validate_catalog");
    expect(m.fire("publish_pinned_catalog", { review: approvedReview() })).toEqual({
      ok: false,
      reason: 'publication_approved_and_versioned does not hold: "interaction-catalog-dev-draft" is not an immutable version identifier',
    });
    expect(m.state).toBe("validated");
  });

  it("retire_catalog_version moves published → retired when catalog_retirement_explicit holds", () => {
    const m = createCatalogMachine(v1Catalog());
    m.fire("validate_catalog");
    m.fire("publish_pinned_catalog", { review: approvedReview() });
    expect(m.fire("retire_catalog_version")).toEqual({
      ok: false,
      reason: "catalog_retirement_explicit does not hold: retirement requires a registered migration or an explicit reissue version",
    });
    expect(m.state).toBe("published");
    const r = m.fire("retire_catalog_version", { retirement: reissueRetirement() });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("retired");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createCatalogMachine(v1Catalog());
    // publish_pinned_catalog starts at validated, not draft
    expect(m.fire("publish_pinned_catalog", { review: approvedReview() })).toEqual({
      ok: false,
      reason: "transition publish_pinned_catalog cannot fire from state draft",
    });
    // correct_catalog starts at invalid
    expect(m.fire("correct_catalog", { nextDefinition: v1Catalog() })).toEqual({
      ok: false,
      reason: "transition correct_catalog cannot fire from state draft",
    });
    // retire_catalog_version starts at published
    expect(m.fire("retire_catalog_version", { retirement: reissueRetirement() })).toEqual({
      ok: false,
      reason: "transition retire_catalog_version cannot fire from state draft",
    });
    expect(m.state).toBe("draft");
  });

  it("unknown transition ids are refused", () => {
    const m = createCatalogMachine(v1Catalog());
    const r = m.fire("explode_catalog" as never);
    expect(r).toEqual({ ok: false, reason: "unknown transition explode_catalog" });
  });
});