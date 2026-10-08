// Purpose: invariant checks for the evidence and provenance layer
// Responsibilities: the seven invariant checks plus evidence-class and source-quality classification
// Rationale: each check names its spec constraint and the precise failure so negative tests can assert it verbatim
import {
  EVIDENCE_CLASSES,
  EXPLICIT_EVIDENCE_STATUSES,
  NORMATIVE_STRENGTHS,
} from "./types";
import type {
  AuditEntry,
  Check,
  EvidenceProposal,
  ImportedClaim,
  ModelProposalRecord,
  RedactionPolicy,
  ReviewRecord,
} from "./types";

const IDENTITY_STRING_FIELDS: readonly (readonly [
  keyof Pick<EvidenceProposal, "id" | "evidenceKind" | "sourceRef" | "schemaVersion">,
  string,
])[] = [
  ["id", "missing stable ID"],
  ["evidenceKind", "missing evidence kind"],
  ["sourceRef", "missing source reference"],
  ["schemaVersion", "missing schema version"],
];

export function evidenceHasIdentity(record: EvidenceProposal): Check {
  for (const [field, label] of IDENTITY_STRING_FIELDS) {
    const value = record[field];
    if (value === undefined || value.length === 0)
      return { ok: false, reason: `evidence_has_identity does not hold: ${label}` };
  }
  if (record.timestamp === undefined && record.sequence === undefined)
    return { ok: false, reason: "evidence_has_identity does not hold: missing timestamp or logical sequence" };
  return { ok: true };
}

export function transformationsLinked(record: EvidenceProposal): Check {
  const refs = record.inputEvidenceRefs;
  if (refs === undefined || refs.length === 0)
    return { ok: false, reason: "transformations_linked does not hold: derived record links to no input evidence" };
  if (record.transformationRevision === undefined || record.transformationRevision.length === 0)
    return { ok: false, reason: "transformations_linked does not hold: missing transformation revision" };
  return { ok: true };
}

export function modelProposalAttributed(proposal: ModelProposalRecord): Check {
  if (proposal.modelProvider === undefined || proposal.modelProvider.length === 0)
    return { ok: false, reason: "model_proposal_attributed does not hold: missing model/provider identifier" };
  if (proposal.promptRevision === undefined || proposal.promptRevision.length === 0)
    return { ok: false, reason: "model_proposal_attributed does not hold: missing prompt or task revision reference" };
  if (proposal.proposalId === undefined || proposal.proposalId.length === 0)
    return { ok: false, reason: "model_proposal_attributed does not hold: missing proposal identity" };
  if (proposal.promptText !== undefined && proposal.promptText.length > 0)
    return { ok: false, reason: "model_proposal_attributed does not hold: model proposal retains sensitive prompt content" };
  return { ok: true };
}

export function reviewActionAttributed(review: ReviewRecord): Check {
  if (review.reviewedRevision === undefined || review.reviewedRevision.length === 0)
    return { ok: false, reason: "review_action_attributed does not hold: missing reviewed revision" };
  if (review.action === undefined || review.action.length === 0)
    return { ok: false, reason: "review_action_attributed does not hold: missing review action" };
  if (review.reviewScope === undefined || review.reviewScope.length === 0)
    return { ok: false, reason: "review_action_attributed does not hold: missing review scope" };
  if (review.provesTruth === true)
    return { ok: false, reason: "review_action_attributed does not hold: approval must not be represented as proof of truth" };
  return { ok: true };
}

export function unknownEvidenceExplicit(record: EvidenceProposal): Check {
  const got = record.status === undefined ? "absent" : record.status;
  if (!(EXPLICIT_EVIDENCE_STATUSES as readonly string[]).includes(record.status ?? "")) {
    return {
      ok: false,
      reason: `unknown_evidence_explicit does not hold: evidence status must be an explicit status (verified, missing, conflicting, stale, unverifiable), got "${got}"`,
    };
  }
  return { ok: true };
}

export function sensitiveDataMinimized(record: EvidenceProposal, policy: RedactionPolicy): Check {
  const sensitive = record.sensitiveFields ?? [];
  const covered = new Set([...policy.redactedFields, ...policy.accessRestrictedFields]);
  if (sensitive.length > 0 && covered.size === 0)
    return { ok: false, reason: "sensitive_data_minimized does not hold: no configured redaction or access policy" };
  for (const field of sensitive) {
    if (!covered.has(field))
      return {
        ok: false,
        reason: `sensitive_data_minimized does not hold: sensitive field "${field}" is not covered by a redaction or access rule`,
      };
  }
  return { ok: true };
}

export function auditRecordsAppendOnly(log: readonly AuditEntry[], entry: AuditEntry): Check {
  if (entry.seq !== log.length)
    return {
      ok: false,
      reason: `audit_records_append_only does not hold: entry seq ${entry.seq} does not continue the committed log (expected seq ${log.length})`,
    };
  if (log.some((e) => e.recordId === entry.recordId))
    return {
      ok: false,
      reason: `audit_records_append_only does not hold: record identity "${entry.recordId}" already exists in the committed audit log`,
    };
  if (entry.replaces !== undefined && !log.some((e) => e.recordId === entry.replaces))
    return {
      ok: false,
      reason: "audit_records_append_only does not hold: correction does not link to a committed record it replaces",
    };
  return { ok: true };
}

export function evidenceClassRecorded(claim: ImportedClaim): Check {
  if (claim.evidenceClass === undefined)
    return { ok: false, reason: "evidence_class_recorded does not hold: imported claim carries no evidence classification" };
  if (!(EVIDENCE_CLASSES as readonly string[]).includes(claim.evidenceClass))
    return {
      ok: false,
      reason: `evidence_class_recorded does not hold: evidence classification "${claim.evidenceClass}" is not one of the five distinguishable classes`,
    };
  if (claim.evidenceClass === "normative_standard" && !hasStandardRef(claim))
    return {
      ok: false,
      reason: 'evidence_class_recorded does not hold: a claim classified "normative_standard" must reference an explicit normative standard',
    };
  return { ok: true };
}

export function sourceQualityNotNormativity(claim: ImportedClaim): Check {
  if (!strengthIsAssigned(claim)) return { ok: false, reason: UNASSIGNED_REASON };
  if (claim.normativeStrength !== "normative") return { ok: true };
  if (claim.evidenceClass === "design_hypothesis" || claim.evidenceClass === "architectural_synthesis")
    return {
      ok: false,
      reason: `source_quality_not_normativity does not hold: research report claim classified "${claim.evidenceClass}" is not normative`,
    };
  if (claim.evidenceClass !== "normative_standard" || !hasStandardRef(claim))
    return { ok: false, reason: UNASSIGNED_REASON };
  return { ok: true };
}

const UNASSIGNED_REASON =
  "source_quality_not_normativity does not hold: normative strength must be explicitly assigned and traceable, never defaulted from the source";

function strengthIsAssigned(claim: ImportedClaim): boolean {
  return claim.normativeStrength !== undefined && (NORMATIVE_STRENGTHS as readonly string[]).includes(claim.normativeStrength);
}

function hasStandardRef(claim: ImportedClaim): boolean {
  return claim.standardRef !== undefined && claim.standardRef.length > 0;
}
