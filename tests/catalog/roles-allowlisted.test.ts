// Purpose: conformance test for invariant roles_allowlisted
// Responsibilities: only registered semantic roles can be rendered
// Rationale: derives_from [[spec.roles_allowlisted]] — predicate: assert at trust boundary
import { describe, it, expect } from "vitest";
import { renderDecision } from "../../src/catalog/index";
import { makeCatalog } from "./fixtures";

describe("roles_allowlisted", () => {
  it("renders a registered semantic role", () => {
    const result = renderDecision(makeCatalog(), "cli", "form.input.text");
    expect(result.ok).toBe(true);
  });

  it("rejects an unregistered role", () => {
    const result = renderDecision(makeCatalog(), "cli", "widget.spooky");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/allowlist|role/i);
  });
});