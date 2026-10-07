// Purpose: conformance test for invariant host_capabilities_declared
// Responsibilities: hosts declare supported roles and limits before presentation selection
// Rationale: derives_from [[spec.host_capabilities_declared]] — predicate: trust boundary
import { describe, it, expect } from "vitest";
import { renderDecision } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("host_capabilities_declared", () => {
  it("renders a role the host has declared", () => {
    const result = renderDecision(makeCatalog(), "cli", "form.input.text");
    expect(result.ok).toBe(true);
  });

  it("rejects a role the host has not declared", () => {
    const catalog = makeCatalog();
    const undeclared = "display.table";
    const stripped = {
      ...catalog,
      hosts: [{ ...catalog.hosts[0]!, roles: ["form.input.text"] }],
    };
    const result = renderDecision(stripped, "cli", undeclared);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/host|declar/i);
  });

  it("rejects a host that never declared capabilities", () => {
    const result = renderDecision(makeCatalog(), "watch", "form.input.text");
    expect(result.ok).toBe(false);
  });
});