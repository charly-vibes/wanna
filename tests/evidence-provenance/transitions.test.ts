// Purpose: transition tests for the evidence and provenance model
// Responsibilities: every [[openspec/specs/evidence-provenance]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: the machine mirrors the spec row for row; guards fail with exact reasons so bypasses cannot hide behind vague refusals
import { describe, it, expect } from "vitest";
import { createEvidenceLayer } from "../../src/evidence-provenance/machine";
import { redactionPolicy, validEvidence } from "./fixtures";

describe("evidence-provenance transitions", () => {
  it("validate_evidence moves proposed → validated when evidence_has_identity holds", () => {
    const m = createEvidenceLayer(validEvidence());
    const r = m.fire("validate_evidence");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
    expect(m.applied).toEqual([{ id: "validate_evidence", from: "proposed", to: "validated" }]);
  });

  it("validate_evidence refuses a record without identity, naming evidence_has_identity and the missing field", () => {
    const m = createEvidenceLayer(validEvidence({ sourceRef: undefined }));
    const r = m.fire("validate_evidence");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("evidence_has_identity does not hold: missing source reference");
    expect(m.state).toBe("proposed");
  });

  it("commit_evidence moves validated → committed when transformations_linked holds", () => {
    const m = createEvidenceLayer(validEvidence());
    m.fire("validate_evidence");
    const r = m.fire("commit_evidence");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("committed");
    expect(m.applied).toEqual([
      { id: "validate_evidence", from: "proposed", to: "validated" },
      { id: "commit_evidence", from: "validated", to: "committed" },
    ]);
  });

  it("commit_evidence refuses a record that links to no input evidence, naming transformations_linked", () => {
    const m = createEvidenceLayer(validEvidence({ inputEvidenceRefs: [] }));
    m.fire("validate_evidence");
    const r = m.fire("commit_evidence");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transformations_linked does not hold: derived record links to no input evidence");
    expect(m.state).toBe("validated");
  });

  it("supersede_evidence moves committed → superseded when the correction is a new linked record appended to the audit log", () => {
    const m = createEvidenceLayer(validEvidence());
    m.fire("validate_evidence");
    m.fire("commit_evidence");
    const r = m.fire("supersede_evidence", { kind: "correction", correctionId: "ev-2" });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("superseded");
    expect(m.auditLog).toEqual([
      { seq: 0, transition: "validate_evidence", recordId: "ev-1" },
      { seq: 1, transition: "commit_evidence", recordId: "ev-1" },
      { seq: 2, transition: "supersede_evidence", recordId: "ev-2", replaces: "ev-1" },
    ]);
  });

  it("supersede_evidence refuses an in-place edit of a committed record, naming audit_records_append_only", () => {
    const m = createEvidenceLayer(validEvidence());
    m.fire("validate_evidence");
    m.fire("commit_evidence");
    const r = m.fire("supersede_evidence", { kind: "correction", correctionId: "ev-1" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "supersede_evidence guard audit_records_append_only does not hold: corrections are new linked records with their own identity, not edits of committed records",
    );
    expect(m.state).toBe("committed");
  });

  it("restrict_sensitive_evidence moves committed → restricted when every sensitive field is covered by policy", () => {
    const m = createEvidenceLayer(validEvidence({ sensitiveFields: ["reviewer_note"] }));
    m.fire("validate_evidence");
    m.fire("commit_evidence");
    const r = m.fire("restrict_sensitive_evidence", { kind: "policy", policy: redactionPolicy() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("restricted");
  });

  it("restrict_sensitive_evidence refuses a policy that leaves a sensitive field uncovered, naming sensitive_data_minimized", () => {
    const m = createEvidenceLayer(validEvidence({ sensitiveFields: ["reviewer_note", "author_email"] }));
    m.fire("validate_evidence");
    m.fire("commit_evidence");
    const r = m.fire("restrict_sensitive_evidence", { kind: "policy", policy: redactionPolicy() });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      'sensitive_data_minimized does not hold: sensitive field "author_email" is not covered by a redaction or access rule',
    );
    expect(m.state).toBe("committed");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createEvidenceLayer(validEvidence());
    for (const id of ["commit_evidence", "supersede_evidence", "restrict_sensitive_evidence"] as const) {
      const r = m.fire(id);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`transition ${id} cannot fire from state proposed`);
    }
    expect(m.state).toBe("proposed");
  });
});
