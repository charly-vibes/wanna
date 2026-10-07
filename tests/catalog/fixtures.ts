// Purpose: shared fixtures for component-catalog conformance tests
// Responsibilities: build valid catalogs/hosts derived from the spec corpus
// Rationale: tracer-bullet phase 2 (wanna-1bb) — tests bind to spec predicates
import type {
  Catalog,
  HostDeclaration,
} from "../../src/catalog/index";

export const GLOBAL_LIMITS = { maxPayloadBytes: 64_000, maxRoles: 100 };

export function makeCatalog(): Catalog {
  return {
    version: "cat-2026.10.1",
    entries: [
      {
        role: "form.input.text",
        schema: { input: "TextIn", response: "TextOut", events: ["change"] },
      },
      {
        role: "display.table",
        schema: { input: "TableIn", response: "TableOut", events: [] },
        fallback: "unsupported",
      },
    ],
    hosts: [makeHost()],
  };
}

export function makeHost(): HostDeclaration {
  return {
    host: "cli",
    roles: ["form.input.text", "display.table"],
    limits: { maxPayloadBytes: 32_000, maxRoles: 50 },
  };
}