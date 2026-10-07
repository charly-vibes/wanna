// Purpose: conformance test for invariant fallback_graph_acyclic
// Responsibilities: fallback mappings form an acyclic graph terminating in a role or unsupported
// Rationale: derives_from [[spec.fallback_graph_acyclic]] — predicate: trust boundary
import { describe, it, expect } from "vitest";
import { fallbackGraphAcyclic } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("fallback_graph_acyclic", () => {
  it("holds for a chain terminating in a supported role", () => {
    const catalog = makeCatalog();
    const chained = {
      ...catalog,
      entries: [
        { role: "a", schema: { input: "A", response: "A", events: [] }, fallback: "b" },
        { role: "b", schema: { input: "B", response: "B", events: [] }, fallback: "unsupported" },
      ],
    };
    expect(fallbackGraphAcyclic(chained)).toBe(true);
  });

  it("rejects a fallback cycle", () => {
    const catalog = makeCatalog();
    const cycled = {
      ...catalog,
      entries: [
        { role: "a", schema: { input: "A", response: "A", events: [] }, fallback: "b" },
        { role: "b", schema: { input: "B", response: "B", events: [] }, fallback: "a" },
      ],
    };
    expect(fallbackGraphAcyclic(cycled)).toBe(false);
  });

  it("rejects a fallback pointing at an unregistered role", () => {
    const catalog = makeCatalog();
    const dangling = {
      ...catalog,
      entries: [
        { role: "a", schema: { input: "A", response: "A", events: [] }, fallback: "ghost" },
      ],
    };
    expect(fallbackGraphAcyclic(dangling)).toBe(false);
  });
});