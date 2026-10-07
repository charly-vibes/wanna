// Purpose: conformance test for invariant catalog_changes_reviewed
// Responsibilities: registration/removal is a versioned trusted change, not runtime mutation
// Rationale: derives_from [[spec.catalog_changes_reviewed]] — predicate: trust boundary
import { describe, it, expect } from "vitest";
import { applyReviewedChange } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("catalog_changes_reviewed", () => {
  it("applies a change that carries a trusted review record and bumps the version", () => {
    const catalog = makeCatalog();
    const next = applyReviewedChange(catalog, {
      review: "review-42",
      change: { kind: "register", entry: { role: "chart.line", schema: { input: "C", response: "C", events: [] } } },
    });
    expect(next.version).not.toBe(catalog.version);
    expect(next.entries.map((e) => e.role)).toContain("chart.line");
  });

  it("refuses an unreviewed change", () => {
    expect(() =>
      applyReviewedChange(makeCatalog(), { review: "", change: { kind: "register", entry: { role: "x", schema: { input: "X", response: "X", events: [] } } } }),
    ).toThrow(/review/i);
  });
});