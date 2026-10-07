// Purpose: conformance tests for the component-catalog model transitions
// Responsibilities: each ## Model transition authorized incl. guard-failure paths
// Rationale: derives_from [[spec]] ## Model — draft/validated/published/deprecated
import { describe, it, expect } from "vitest";
import { createCatalogMachine } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("model transitions", () => {
  it("validate_catalog moves draft to validated when schema_mapping_explicit holds", () => {
    const m = createCatalogMachine(makeCatalog());
    const r = m.validateCatalog();
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("reject_catalog moves draft to deprecated when the guard fails", () => {
    const catalog = makeCatalog();
    const broken = {
      ...catalog,
      entries: [{ role: "x", schema: { input: "", response: "", events: [] } }],
    };
    const m = createCatalogMachine(broken);
    const r = m.rejectCatalog();
    expect(r.ok).toBe(true);
    expect(m.state).toBe("deprecated");
  });

  it("validate_catalog is refused when the guard fails, state unchanged", () => {
    const catalog = makeCatalog();
    const broken = {
      ...catalog,
      entries: [{ role: "x", schema: { input: "", response: "Y", events: [] } }],
    };
    const m = createCatalogMachine(broken);
    const r = m.validateCatalog();
    expect(r.ok).toBe(false);
    expect(m.state).toBe("draft");
  });

  it("publish_catalog moves validated to published when the version is pinned", () => {
    const m = createCatalogMachine(makeCatalog());
    m.validateCatalog();
    const r = m.publishCatalog();
    expect(r.ok).toBe(true);
    expect(m.state).toBe("published");
  });

  it("publish_catalog is refused from draft (state machine, not guard)", () => {
    const m = createCatalogMachine(makeCatalog());
    expect(m.publishCatalog().ok).toBe(false);
    expect(m.state).toBe("draft");
  });

  it("deprecate_catalog moves published to deprecated with a review record", () => {
    const m = createCatalogMachine(makeCatalog(), { review: "review-7" });
    m.validateCatalog();
    m.publishCatalog();
    const r = m.deprecateCatalog();
    expect(r.ok).toBe(true);
    expect(m.state).toBe("deprecated");
  });

  it("deprecate_catalog is refused without a review record", () => {
    const m = createCatalogMachine(makeCatalog());
    m.validateCatalog();
    m.publishCatalog();
    expect(m.deprecateCatalog().ok).toBe(false);
    expect(m.state).toBe("published");
  });

  it("records every accepted transition in order", () => {
    const m = createCatalogMachine(makeCatalog(), { review: "review-7" });
    m.validateCatalog();
    m.publishCatalog();
    m.deprecateCatalog();
    expect(m.log.map((t) => t.id)).toEqual(["validate_catalog", "publish_catalog", "deprecate_catalog"]);
  });
});