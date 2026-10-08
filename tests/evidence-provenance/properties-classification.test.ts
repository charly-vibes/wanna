// Purpose: property tests for evidence classification of imported research claims
// Responsibilities: the two classification properties — evidence_class_recorded and source_quality_not_normativity; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/evidence-provenance/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  EVIDENCE_CLASSES,
  evidenceClassRecorded,
  sourceQualityNotNormativity,
  NORMATIVE_STRENGTHS,
} from "../../src/evidence-provenance/index";
import type { EvidenceClass, ImportedClaim, NormativeStrength } from "../../src/evidence-provenance/index";
import { importedClaim } from "./fixtures";

describe("evidence-provenance classification properties", () => {
  it("Traceability test: each research-derived normative constraint has an evidence classification", () => {
    // the open set of classes is closed and distinguishable
    expect(EVIDENCE_CLASSES).toEqual([
      "normative_standard",
      "empirical_evidence",
      "established_guidance",
      "architectural_synthesis",
      "design_hypothesis",
    ]);
    // every class satisfies the invariant on a real claim
    for (const evidenceClass of EVIDENCE_CLASSES) {
      expect(evidenceClassRecorded(importedClaim({ evidenceClass, standardRef: "STD-1" })).ok).toBe(true);
    }
    // a claim with no classification fails
    expect(evidenceClassRecorded(importedClaim({ evidenceClass: undefined }))).toEqual({
      ok: false,
      reason: "evidence_class_recorded does not hold: imported claim carries no evidence classification",
    });
    expect(
      evidenceClassRecorded({
        claimId: "rc-1",
        sourceRef: "research://wanna/u08",
        evidenceClass: "unclassified" as unknown as EvidenceClass,
        normativeStrength: "non_normative",
      }),
    ).toEqual({
      ok: false,
      reason: "evidence_class_recorded does not hold: evidence classification \"unclassified\" is not one of the five distinguishable classes",
    });
    // a non-standard claim classified as normative_standard is incoherent
    expect(
      evidenceClassRecorded(importedClaim({ evidenceClass: "normative_standard", standardRef: undefined })),
    ).toEqual({
      ok: false,
      reason: 'evidence_class_recorded does not hold: a claim classified "normative_standard" must reference an explicit normative standard',
    });
  });

  it("a claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable", () => {
    // normative strength is an explicitly assigned, closed set — never defaulted from the source
    expect(NORMATIVE_STRENGTHS).toEqual(["normative", "non_normative", "unknown"]);
    // a research report must carry non_normative or unknown strength
    expect(
      sourceQualityNotNormativity(importedClaim({ evidenceClass: "empirical_evidence", normativeStrength: "non_normative" })).ok,
    ).toBe(true);
    expect(
      sourceQualityNotNormativity(importedClaim({ evidenceClass: "established_guidance", normativeStrength: "unknown" })).ok,
    ).toBe(true);
    expect(
      sourceQualityNotNormativity(importedClaim({ evidenceClass: "normative_standard", standardRef: "ISO-27001", normativeStrength: "normative" })).ok,
    ).toBe(true);
    // an unassigned strength is refused — never defaulted from a research report
    expect(
      sourceQualityNotNormativity(importedClaim({ normativeStrength: undefined })),
    ).toEqual({
      ok: false,
      reason: "source_quality_not_normativity does not hold: normative strength must be explicitly assigned and traceable, never defaulted from the source",
    });
    expect(
      sourceQualityNotNormativity({
        claimId: "rc-1",
        sourceRef: "research://wanna/u08",
        evidenceClass: "empirical_evidence",
        // a strength outside the explicit set is incoherent — refused, never defaulted
        normativeStrength: "strong" as unknown as NormativeStrength,
      }),
    ).toEqual({
      ok: false,
      reason: "source_quality_not_normativity does not hold: normative strength must be explicitly assigned and traceable, never defaulted from the source",
    });
    // normative strength without a traced standard is refused
    expect(
      sourceQualityNotNormativity(importedClaim({ normativeStrength: "normative", standardRef: undefined })),
    ).toEqual({
      ok: false,
      reason: "source_quality_not_normativity does not hold: normative strength must be explicitly assigned and traceable, never defaulted from the source",
    });
    // a research report carrying default normative strength is refused
    expect(
      sourceQualityNotNormativity(importedClaim({ evidenceClass: "design_hypothesis", normativeStrength: "normative" })),
    ).toEqual({
      ok: false,
      reason: "source_quality_not_normativity does not hold: research report claim classified \"design_hypothesis\" is not normative",
    });
    expect(
      sourceQualityNotNormativity(importedClaim({ evidenceClass: "architectural_synthesis", normativeStrength: "normative" })),
    ).toEqual({
      ok: false,
      reason: "source_quality_not_normativity does not hold: research report claim classified \"architectural_synthesis\" is not normative",
    });
    // the invariants agree on a coherent real claim
    const claim: ImportedClaim = importedClaim();
    expect(evidenceClassRecorded(claim).ok).toBe(true);
    expect(sourceQualityNotNormativity(claim).ok).toBe(true);
    // type-level check: EvidenceClass and NormativeStrength are the closed sets above
    const cls: EvidenceClass = "empirical_evidence";
    const str: NormativeStrength = "unknown";
    expect([cls, str]).toEqual(["empirical_evidence", "unknown"]);
  });
});
