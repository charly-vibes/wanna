// Purpose: fast-check property-based tests for the interaction-need normalizer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-need/spec.md);
//   contracts bind via `vitest run tests/interaction-need/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { NEED_KINDS, needSchemaValid, unresolvedRequiresChange } from "../../src/interaction-need/index";
import type { EvidenceStrength, NeedProposal, UnresolvedNeed } from "../../src/interaction-need/index";
import { PRESENTATION_VOCABULARY } from "../../src/interaction-need/index";
import { validProposal } from "./fixtures";

const evidenceArb = fc.constantFrom<EvidenceStrength>(
  "missing", "contradictory", "ambiguous", "weak", "sufficient",
);

// targets free of presentation vocabulary so well-formed cases stay well-formed
const cleanTargetArb = fc
  .stringMatching(/^[a-z ]{8,60}$/)
  .filter((s) => PRESENTATION_VOCABULARY.every((token) => !s.toLowerCase().includes(token)));

const proposalArb: fc.Arbitrary<NeedProposal> = fc
  .record({
    kind: fc.constantFrom(...NEED_KINDS),
    target: cleanTargetArb,
    taskRevision: fc.stringMatching(/^task-[0-9]{1,4}$/),
    proposalId: fc.stringMatching(/^need-prop-[0-9]{1,4}$/),
    evidenceRefs: fc.array(fc.stringMatching(/^ev-[0-9]{1,3}$/), { minLength: 1, maxLength: 4 }),
    evidenceStrength: evidenceArb,
  })
  .map((r) => validProposal(r));

describe("interaction-need properties (fast-check)", () => {
  it("a need validates against the versioned canonical schema before policy evaluation", () => {
    fc.assert(
      fc.property(proposalArb, fc.integer({ min: 0, max: 99 }), (proposal, violation) => {
        // every well-formed proposal validates
        expect(needSchemaValid(proposal).ok).toBe(true);
        // each single-field violation invalidates it, named precisely
        const violations = new Map<number, NeedProposal>([
          [0, { ...proposal, kind: "not_a_kind" }],
          [1, { ...proposal, target: "" }],
          [2, { ...proposal, target: ["gap-a", "gap-b"] as never }],
          [3, { ...proposal, proposalId: "" }],
          [4, { ...proposal, target: `${proposal.target} modal` }],
        ]);
        const violated = violations.get(violation % violations.size)!;
        expect(needSchemaValid(violated).ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("Security test: changing model confidence alone cannot change a hard gate", () => {
    fc.assert(
      fc.property(proposalArb, fc.nat({ max: 100 }), fc.nat({ max: 100 }), (proposal, c1, c2) => {
        // schema validity is invariant to the confidence value — hard gates do not move
        const a = needSchemaValid({ ...proposal, confidence: c1 / 100 });
        const b = needSchemaValid({ ...proposal, confidence: c2 / 100 });
        expect(a).toEqual(b);
        // confidence is not a semantic change: an unresolved need cannot retry on confidence alone
        const record: UnresolvedNeed = {
          kind: proposal.kind,
          target: proposal.target,
          taskRevision: proposal.taskRevision,
          proposalId: proposal.proposalId,
          evidenceRefs: [...proposal.evidenceRefs],
          reason: "insufficient evidence",
        };
        const retry = unresolvedRequiresChange(record, { ...proposal, confidence: c2 / 100 });
        expect(retry.ok).toBe(false);
        if (!retry.ok) expect(retry.reason).toMatch(/confidence and proposal identity are not changes/);
      }),
      { numRuns: 100 },
    );
  });
});
