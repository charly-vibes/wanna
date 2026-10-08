// Purpose: fast-check property-based tests for the interaction-primitives gate
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-primitives/spec.md);
//   contracts bind via `vitest run tests/interaction-primitives/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  ALLOWED_AUTHORITY_SOURCES,
  EVIDENCE_CLASSES,
  GENERIC_AUTHORITY_SOURCES,
  authorityOrthogonal,
  evidenceStrengthExplicit,
  genericSignalCannotGrant,
} from "../../src/interaction-primitives/index";
import type { AuthorityGrant, PrimitiveRevision } from "../../src/interaction-primitives/index";
import { validRevision } from "./fixtures";

const genericGrantArb: fc.Arbitrary<AuthorityGrant> = fc
  .record({ grantId: fc.stringMatching(/^g-[a-z0-9]{1,4}$/), effect: fc.stringMatching(/^[a-z_]{1,10}$/) })
  .map((g) => ({ ...g, source: fc.sample(fc.constantFrom(...GENERIC_AUTHORITY_SOURCES), { numRuns: 1 })[0]! }));

const provenanceArb = fc.record({
  claimId: fc.stringMatching(/^e-[a-z0-9]{1,4}$/),
  evidenceClass: fc.option(fc.constantFrom(...EVIDENCE_CLASSES), { nil: undefined }),
});

describe("interaction-primitives properties (fast-check)", () => {
  it("model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority", () => {
    fc.assert(
      fc.property(fc.array(genericGrantArb, { maxLength: 6 }), (grants) => {
        if (grants.length === 0) return;
        // a revision whose authority grants ALL derive from generic signals is rejected
        const revision: PrimitiveRevision = validRevision({ authorityGrants: grants });
        expect(authorityOrthogonal(revision).ok).toBe(false);
        // each generic signal individually cannot be an authority source
        expect(grants.every((g) => !genericSignalCannotGrant(g))).toBe(true);
        expect(grants.every((g) => !(ALLOWED_AUTHORITY_SOURCES as readonly string[]).includes(g.source))).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Schema test: imported research claims declare evidence class instead of becoming silently normative", () => {
    fc.assert(
      fc.property(fc.array(provenanceArb, { maxLength: 8 }), (provenance) => {
        const revision: PrimitiveRevision = validRevision({ provenance });
        const silent = provenance.find((p) => p.evidenceClass === undefined);
        const check = evidenceStrengthExplicit(revision);
        expect(check.ok).toBe(silent === undefined);
        if (!check.ok && silent) {
          expect(check.reason).toBe(
            `provenance record "${silent.claimId}" declares no evidence class and would become silently normative`,
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});
