// Purpose: conformance test for invariant catalog_version_pinned
// Responsibilities: every render decision pins one immutable catalog version and records it
// Rationale: derives_from [[spec.catalog_version_pinned]] — predicate: assert at trust boundary
import { describe, it, expect } from "vitest";
import { renderDecision } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("catalog_version_pinned", () => {
  it("records the catalog version in the render result", () => {
    const catalog = makeCatalog();
    const result = renderDecision(catalog, "cli", "form.input.text");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.catalogVersion).toBe(catalog.version);
  });

  it("rejects a render against an unpinned (empty-version) catalog", () => {
    const catalog = { ...makeCatalog(), version: "" };
    const result = renderDecision(catalog, "cli", "form.input.text");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/pinned|version/i);
  });
});