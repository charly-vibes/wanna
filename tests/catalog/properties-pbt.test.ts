// Purpose: fast-check property-based tests for the component-catalog invariants
// Responsibilities: escalate generator-friendly invariant assertions to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/component-catalog/spec.md);
//   contracts bind via `vitest run tests/catalog/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { fallbackGraphAcyclic, limitsConsistent } from "../../src/catalog/index";
import type { Catalog, CatalogEntry, HostDeclaration } from "../../src/catalog/index";

const entryArb = fc
  .record({ role: fc.stringMatching(/^[a-z]{1,6}$/), fallback: fc.option(fc.stringMatching(/^[a-z]{1,6}$/)) })
  // CatalogEntry.fallback is optional: undefined means "no fallback declared"
  .map((r) =>
    r.fallback === null
      ? { role: r.role, schema: { input: "I", response: "R", events: [] } }
      : { role: r.role, schema: { input: "I", response: "R", events: [] }, fallback: r.fallback },
  );

const catalogArb: fc.Arbitrary<Catalog> = fc
  .record({
    version: fc.constant("cat-2026.10.1"),
    entries: fc.array(entryArb, { minLength: 1, maxLength: 10 }),
    hosts: fc.array(hostArb(), { maxLength: 3 }),
  })
  .filter((c) => c.entries.every((e, i, all) => all.findIndex((o) => o.role === e.role) === i));

function hostArb(): fc.Arbitrary<HostDeclaration> {
  return fc.record({
    host: fc.stringMatching(/^[a-z]{1,6}$/),
    roles: fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 5 }),
    limits: fc.record({ maxPayloadBytes: fc.nat({ max: 1_000_000 }), maxRoles: fc.nat({ max: 1000 }) }),
  });
}

describe("component-catalog invariants (fast-check)", () => {
  it("TypeScript conformance test: assert invariant fallback_graph_acyclic at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(catalogArb, (catalog) => {
        const ok = fallbackGraphAcyclic(catalog);
        // independent witness: walking every fallback chain must terminate in "unsupported"
        // or a registered role with no fallback, using only registered intermediate roles
        const roles = new Set(catalog.entries.map((e) => e.role));
        const terminates = catalog.entries.every((e) => {
          const seen = new Set<string>([e.role]);
          let cur: CatalogEntry["fallback"] = e.fallback;
          while (typeof cur === "string" && cur !== "unsupported") {
            if (!roles.has(cur) || seen.has(cur)) return false;
            seen.add(cur);
            cur = catalog.entries.find((o) => o.role === cur)?.fallback;
          }
          return true;
        });
        expect(ok).toBe(terminates);
        // a manually injected cycle is always rejected, whatever the generated shape
        if (catalog.entries.length >= 2) {
          const [a, b] = catalog.entries;
          const cycled: Catalog = {
            ...catalog,
            entries: [
              { ...a!, fallback: b!.role },
              { ...b!, fallback: a!.role },
            ],
          };
          expect(fallbackGraphAcyclic(cycled)).toBe(false);
        }
        // a dangling fallback (target not registered) is always rejected
        const dangling: Catalog = {
          ...catalog,
          entries: [{ role: "solo", schema: { input: "I", response: "R", events: [] }, fallback: "ghost" }],
        };
        expect(fallbackGraphAcyclic(dangling)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript conformance test: assert invariant limits_consistent at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        fc.nat({ max: 1000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.nat({ max: 5 }),
        (maxPayloadBytes, maxRoles, payloadOver, rolesOver, hostCount) => {
          const global = { maxPayloadBytes, maxRoles };
          const within: HostDeclaration = {
            host: "cli",
            roles: [],
            limits: { maxPayloadBytes, maxRoles },
          };
          expect(limitsConsistent({ version: "v", entries: [], hosts: [within] }, global)).toBe(true);
          // any single host exceeding either global limit breaks the invariant
          const overPayload: HostDeclaration = {
            ...within,
            limits: { ...within.limits, maxPayloadBytes: maxPayloadBytes + payloadOver },
          };
          const overRoles: HostDeclaration = {
            ...within,
            limits: { ...within.limits, maxRoles: maxRoles + rolesOver },
          };
          expect(limitsConsistent({ version: "v", entries: [], hosts: [overPayload] }, global)).toBe(false);
          expect(limitsConsistent({ version: "v", entries: [], hosts: [overRoles] }, global)).toBe(false);
          // the invariant is a conjunction over all hosts: one bad host among many fails
          const hosts: HostDeclaration[] =
            hostCount === 0 ? [within] : [within, ...(hostCount > 1 ? [overPayload] : [])];
          expect(
            limitsConsistent({ version: "v", entries: [], hosts }, global),
          ).toBe(hosts.every((h) => h.limits.maxPayloadBytes <= global.maxPayloadBytes));
        },
      ),
      { numRuns: 100 },
    );
  });
});
