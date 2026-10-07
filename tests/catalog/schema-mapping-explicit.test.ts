// Purpose: conformance test for invariant schema_mapping_explicit
// Responsibilities: each role declares typed input + response/event schemas
// Rationale: derives_from [[spec.schema_mapping_explicit]] — predicate: trust boundary
import { describe, it, expect } from "vitest";
import { schemaMappingExplicit } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("schema_mapping_explicit", () => {
  it("holds when every entry declares typed schemas", () => {
    expect(schemaMappingExplicit(makeCatalog())).toBe(true);
  });

  it("fails when an entry lacks a typed input schema", () => {
    const catalog = makeCatalog();
    const broken = {
      ...catalog,
      entries: [
        catalog.entries[0]!,
        { role: "display.table", schema: { input: "", response: "TableOut", events: [] } },
      ],
    };
    expect(schemaMappingExplicit(broken)).toBe(false);
  });

  it("fails when an entry lacks a typed response schema", () => {
    const catalog = makeCatalog();
    const broken = {
      ...catalog,
      entries: [{ role: "x", schema: { input: "In", response: "", events: [] } }],
    };
    expect(schemaMappingExplicit(broken)).toBe(false);
  });
});