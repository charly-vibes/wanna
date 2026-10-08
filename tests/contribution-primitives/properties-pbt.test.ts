// Purpose: fast-check property-based tests for the contribution-primitives layer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/contribution-primitives/spec.md);
//   contracts bind via `vitest run tests/contribution-primitives/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  ESCAPE_OUTCOMES,
  authorizeGuardSatisfied,
  escapeSemanticsExplicit,
} from "../../src/contribution-primitives/index";
import type { AuthorityGrant, PrimitiveProposal } from "../../src/contribution-primitives/index";
import { validProposal } from "./fixtures";

const grantArb: fc.Arbitrary<AuthorityGrant> = fc.record({
  interactionId: fc.string({ minLength: 1 }),
  kind: fc.constantFrom("authorize", "verify", "select", "confirm", "annotate"),
});

const proposalArb: fc.Arbitrary<PrimitiveProposal> = fc
  .record({
    kind: fc.constantFrom("select", "confirm", "annotate", "verify", "authorize", "reject"),
    interactionId: fc.string({ minLength: 1 }),
    taskRevision: fc.string({ minLength: 1 }),
    provenance: fc.array(fc.string({ minLength: 1 }), { maxLength: 4 }),
  })
  .map((r) => validProposal(r));

describe("contribution-primitives properties (fast-check)", () => {
  it("Security test: a verify event alone cannot satisfy an authorize guard", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.array(grantArb, { maxLength: 8 }), (interactionId, grants) => {
        // a verify event is denied whatever grants exist — even its own interaction's grant
        const verify = authorizeGuardSatisfied({ kind: "verify", interactionId }, grants);
        expect(verify.ok).toBe(false);
        if (!verify.ok) {
          expect(verify.reason).toBe(
            "verification_distinct_from_authorization: a verify event cannot satisfy an authorize guard; policy must separately require and record both semantics",
          );
        }
        // a matching authorize grant (same interaction, kind authorize) is the only acceptance path
        const withAuthorize = authorizeGuardSatisfied(
          { kind: "authorize", interactionId },
          [...grants, { interactionId, kind: "authorize" }],
        );
        expect(withAuthorize.ok).toBe(true);
        // the same authorize event without an applicable grant never creates authority
        const ungranted = authorizeGuardSatisfied(
          { kind: "authorize", interactionId },
          grants.filter((g) => !(g.kind === "authorize" && g.interactionId === interactionId)),
        );
        expect(ungranted.ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript test: cancel/defer/dismiss outcomes are never coerced into a substantive response", () => {
    fc.assert(
      fc.property(proposalArb, fc.option(fc.constantFrom(...ESCAPE_OUTCOMES)), (proposal, outcome) => {
        const check = escapeSemanticsExplicit(proposal, outcome ?? undefined);
        if (outcome === null) {
          // a missing escape outcome is never treated as an answer
          expect(check.ok).toBe(false);
          expect(check.reason).toMatch(/no escape outcome supplied/);
          return;
        }
        // every declared escape outcome has an explicit effect under the default declaration
        expect(check.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
