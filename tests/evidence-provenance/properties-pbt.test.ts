// Purpose: fast-check property-based test for source quality vs normativity
// Responsibilities: the p_source_quality_not_normativity corpus property over arbitrary generated claim states (100+ cases)
// Rationale: generator `arbitrary_state()` recorded in the corpus generator column; contracts bind via `vitest run -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import {
  EVIDENCE_CLASSES,
  NORMATIVE_STRENGTHS,
  sourceQualityNotNormativity,
} from "../../src/evidence-provenance/index";
import type { ImportedClaim } from "../../src/evidence-provenance/index";

const UNASSIGNED_REASON =
  "source_quality_not_normativity does not hold: normative strength must be explicitly assigned and traceable, never defaulted from the source";

const claimArb: fc.Arbitrary<ImportedClaim> = fc
  .record({
    claimId: fc.stringMatching(/^rc-[0-9]{1,3}$/),
    sourceRef: fc.stringMatching(/^research:\/\/[a-z]{1,8}$/),
    evidenceClass: fc.constantFrom(...EVIDENCE_CLASSES),
    normativeStrength: fc.constantFrom(...NORMATIVE_STRENGTHS),
    standardRef: fc
      .option(fc.stringMatching(/^STD-[0-9]{1,3}$/))
      .map((ref) => (ref === null ? undefined : ref)),
  })
  .map((r) => r as ImportedClaim);

describe("evidence-provenance properties (fast-check)", () => {
  it("a claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable", () => {
    fc.assert(
      fc.property(claimArb, (claim) => {
        const verdict = sourceQualityNotNormativity(claim);
        // an explicitly assigned non-normative strength never defaults from the source
        if (claim.normativeStrength !== "normative") {
          expect(verdict).toEqual({ ok: true });
          return;
        }
        // a normative strength is only traceable when backed by an explicit standard
        const standardBacked =
          claim.evidenceClass === "normative_standard" &&
          claim.standardRef !== undefined &&
          claim.standardRef.length > 0;
        if (!standardBacked) {
          const expectedReason =
            claim.evidenceClass === "design_hypothesis" || claim.evidenceClass === "architectural_synthesis"
              ? `source_quality_not_normativity does not hold: research report claim classified "${claim.evidenceClass}" is not normative`
              : UNASSIGNED_REASON;
          expect(verdict).toEqual({ ok: false, reason: expectedReason });
          return;
        }
        expect(verdict).toEqual({ ok: true });
      }),
      { numRuns: 200 },
    );
    // spot-check both outcomes outside the generator, with exact reasons
    const normative = sourceQualityNotNormativity({
      claimId: "rc-2",
      sourceRef: "research://wanna/53d",
      evidenceClass: "normative_standard",
      normativeStrength: "normative",
      standardRef: "STD-42",
    });
    expect(normative).toEqual({ ok: true });
    const defaulted = sourceQualityNotNormativity({
      claimId: "rc-3",
      sourceRef: "research://wanna/53d",
      evidenceClass: "empirical_evidence",
      normativeStrength: "normative",
    });
    expect(defaulted).toEqual({ ok: false, reason: UNASSIGNED_REASON });
  });
});
