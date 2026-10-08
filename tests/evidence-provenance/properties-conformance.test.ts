// Purpose: conformance property tests for the evidence and provenance invariants
// Responsibilities: the seven TypeScript conformance corpus properties; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/evidence-provenance/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createEvidenceLayer } from "../../src/evidence-provenance/machine";
import {
  auditRecordsAppendOnly,
  evidenceHasIdentity,
  modelProposalAttributed,
  reviewActionAttributed,
  sensitiveDataMinimized,
  transformationsLinked,
  unknownEvidenceExplicit,
  EXPLICIT_EVIDENCE_STATUSES,
} from "../../src/evidence-provenance/index";
import type { AuditEntry } from "../../src/evidence-provenance/index";
import { modelProposal, redactionPolicy, reviewRecord, validEvidence } from "./fixtures";

describe("evidence-provenance conformance properties", () => {
  it("TypeScript conformance test: assert invariant evidence_has_identity at its trust boundary and under its stated edge cases.", () => {
    expect(evidenceHasIdentity(validEvidence()).ok).toBe(true);
    // each required identity field dropped at the trust boundary fails, named precisely
    expect(evidenceHasIdentity(validEvidence({ id: undefined }))).toEqual({
      ok: false,
      reason: "evidence_has_identity does not hold: missing stable ID",
    });
    expect(evidenceHasIdentity(validEvidence({ evidenceKind: undefined }))).toEqual({
      ok: false,
      reason: "evidence_has_identity does not hold: missing evidence kind",
    });
    expect(evidenceHasIdentity(validEvidence({ sourceRef: undefined }))).toEqual({
      ok: false,
      reason: "evidence_has_identity does not hold: missing source reference",
    });
    expect(evidenceHasIdentity(validEvidence({ schemaVersion: undefined }))).toEqual({
      ok: false,
      reason: "evidence_has_identity does not hold: missing schema version",
    });
    // edge case: timestamp OR logical sequence satisfies the pair requirement
    expect(evidenceHasIdentity(validEvidence({ timestamp: undefined })).ok).toBe(true);
    expect(evidenceHasIdentity(validEvidence({ sequence: undefined })).ok).toBe(true);
    expect(evidenceHasIdentity(validEvidence({ timestamp: undefined, sequence: undefined }))).toEqual({
      ok: false,
      reason: "evidence_has_identity does not hold: missing timestamp or logical sequence",
    });
  });

  it("TypeScript conformance test: assert invariant transformations_linked at its trust boundary and under its stated edge cases.", () => {
    expect(transformationsLinked(validEvidence()).ok).toBe(true);
    expect(transformationsLinked(validEvidence({ inputEvidenceRefs: [] }))).toEqual({
      ok: false,
      reason: "transformations_linked does not hold: derived record links to no input evidence",
    });
    expect(transformationsLinked(validEvidence({ transformationRevision: undefined }))).toEqual({
      ok: false,
      reason: "transformations_linked does not hold: missing transformation revision",
    });
    // the machine enforces the same invariant at the commit trust boundary
    const m = createEvidenceLayer(validEvidence({ inputEvidenceRefs: [] }));
    m.fire("validate_evidence");
    expect(m.fire("commit_evidence").ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant model_proposal_attributed at its trust boundary and under its stated edge cases.", () => {
    expect(modelProposalAttributed(modelProposal()).ok).toBe(true);
    expect(modelProposalAttributed(modelProposal({ modelProvider: undefined }))).toEqual({
      ok: false,
      reason: "model_proposal_attributed does not hold: missing model/provider identifier",
    });
    expect(modelProposalAttributed(modelProposal({ promptRevision: undefined }))).toEqual({
      ok: false,
      reason: "model_proposal_attributed does not hold: missing prompt or task revision reference",
    });
    expect(modelProposalAttributed(modelProposal({ proposalId: undefined }))).toEqual({
      ok: false,
      reason: "model_proposal_attributed does not hold: missing proposal identity",
    });
    // sensitive prompt content is not retained indefinitely — attribution works without it
    expect(modelProposalAttributed(modelProposal({ promptText: "the full raw prompt" }))).toEqual({
      ok: false,
      reason: "model_proposal_attributed does not hold: model proposal retains sensitive prompt content",
    });
  });

  it("TypeScript conformance test: assert invariant review_action_attributed at its trust boundary and under its stated edge cases.", () => {
    expect(reviewActionAttributed(reviewRecord()).ok).toBe(true);
    expect(reviewActionAttributed(reviewRecord({ reviewedRevision: undefined }))).toEqual({
      ok: false,
      reason: "review_action_attributed does not hold: missing reviewed revision",
    });
    expect(reviewActionAttributed(reviewRecord({ action: undefined }))).toEqual({
      ok: false,
      reason: "review_action_attributed does not hold: missing review action",
    });
    expect(reviewActionAttributed(reviewRecord({ reviewScope: undefined }))).toEqual({
      ok: false,
      reason: "review_action_attributed does not hold: missing review scope",
    });
    // approval is not represented as proof of truth
    expect(reviewActionAttributed(reviewRecord({ provesTruth: true }))).toEqual({
      ok: false,
      reason: "review_action_attributed does not hold: approval must not be represented as proof of truth",
    });
  });

  it("TypeScript conformance test: assert invariant unknown_evidence_explicit at its trust boundary and under its stated edge cases.", () => {
    for (const status of EXPLICIT_EVIDENCE_STATUSES) {
      expect(unknownEvidenceExplicit(validEvidence({ status })).ok).toBe(true);
    }
    expect(unknownEvidenceExplicit(validEvidence({ status: undefined }))).toEqual({
      ok: false,
      reason: 'unknown_evidence_explicit does not hold: evidence status must be an explicit status (verified, missing, conflicting, stale, unverifiable), got "absent"',
    });
    expect(unknownEvidenceExplicit(validEvidence({ status: "probably fine" }))).toEqual({
      ok: false,
      reason: 'unknown_evidence_explicit does not hold: evidence status must be an explicit status (verified, missing, conflicting, stale, unverifiable), got "probably fine"',
    });
  });

  it("TypeScript conformance test: assert invariant sensitive_data_minimized at its trust boundary and under its stated edge cases.", () => {
    // redaction or access restriction covers every sensitive field
    expect(sensitiveDataMinimized(validEvidence({ sensitiveFields: ["reviewer_note"] }), redactionPolicy()).ok).toBe(true);
    expect(
      sensitiveDataMinimized(validEvidence({ sensitiveFields: ["author_email"] }), redactionPolicy({ redactedFields: [], accessRestrictedFields: ["author_email"] })).ok,
    ).toBe(true);
    // nothing sensitive is vacuously minimized
    expect(sensitiveDataMinimized(validEvidence(), redactionPolicy({ redactedFields: [] })).ok).toBe(true);
    expect(sensitiveDataMinimized(validEvidence({ sensitiveFields: ["reviewer_note"] }), redactionPolicy({ redactedFields: [], accessRestrictedFields: [] }))).toEqual({
      ok: false,
      reason: "sensitive_data_minimized does not hold: no configured redaction or access policy",
    });
    expect(sensitiveDataMinimized(validEvidence({ sensitiveFields: ["author_email"] }), redactionPolicy())).toEqual({
      ok: false,
      reason: 'sensitive_data_minimized does not hold: sensitive field "author_email" is not covered by a redaction or access rule',
    });
  });

  it("TypeScript conformance test: assert invariant audit_records_append_only at its trust boundary and under its stated edge cases.", () => {
    const log: readonly AuditEntry[] = [
      { seq: 0, transition: "validate_evidence", recordId: "ev-1" },
      { seq: 1, transition: "commit_evidence", recordId: "ev-1" },
    ];
    // an appending correction continues the log and links to the record it replaces
    expect(auditRecordsAppendOnly(log, { seq: 2, transition: "supersede_evidence", recordId: "ev-2", replaces: "ev-1" }).ok).toBe(true);
    // an entry that would overwrite a committed seq is refused
    expect(auditRecordsAppendOnly(log, { seq: 1, transition: "commit_evidence", recordId: "ev-3" })).toEqual({
      ok: false,
      reason: "audit_records_append_only does not hold: entry seq 1 does not continue the committed log (expected seq 2)",
    });
    // a duplicate record identity is refused
    expect(auditRecordsAppendOnly(log, { seq: 2, transition: "commit_evidence", recordId: "ev-1" })).toEqual({
      ok: false,
      reason: 'audit_records_append_only does not hold: record identity "ev-1" already exists in the committed audit log',
    });
    // a correction that links to nothing committed is refused
    expect(auditRecordsAppendOnly(log, { seq: 2, transition: "supersede_evidence", recordId: "ev-2", replaces: "ev-404" })).toEqual({
      ok: false,
      reason: "audit_records_append_only does not hold: correction does not link to a committed record it replaces",
    });
  });
});
