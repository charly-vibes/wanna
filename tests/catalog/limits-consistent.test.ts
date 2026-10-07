// Purpose: conformance test for invariant limits_consistent
// Responsibilities: host limits cannot exceed global security/interaction-contract limits
// Rationale: derives_from [[spec.limits_consistent]] — predicate: trust boundary
import { describe, it, expect } from "vitest";
import { limitsConsistent } from "../../src/catalog/index";
import { GLOBAL_LIMITS, makeCatalog } from "./fixtures";

describe("limits_consistent", () => {
  it("holds when host limits are within global limits", () => {
    expect(limitsConsistent(makeCatalog(), GLOBAL_LIMITS)).toBe(true);
  });

  it("fails when a host exceeds the global payload limit", () => {
    const catalog = makeCatalog();
    const over = {
      ...catalog,
      hosts: [{ ...catalog.hosts[0]!, limits: { maxPayloadBytes: 1_000_000, maxRoles: 10 } }],
    };
    expect(limitsConsistent(over, GLOBAL_LIMITS)).toBe(false);
  });

  it("fails when a host exceeds the global role limit", () => {
    const catalog = makeCatalog();
    const over = {
      ...catalog,
      hosts: [{ ...catalog.hosts[0]!, limits: { maxPayloadBytes: 100, maxRoles: 500 } }],
    };
    expect(limitsConsistent(over, GLOBAL_LIMITS)).toBe(false);
  });
});