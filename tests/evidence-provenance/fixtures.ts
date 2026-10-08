// Purpose: fixture factories shared by the evidence-provenance property tests
// Responsibilities: the three minimal fixtures — evidence records, model proposals, review records, redaction policies, imported claims
// Rationale: TDD fixtures live here so the two property test files stay parallel and pilot-style
import type {
  EvidenceClass,
  EvidenceProposal,
  ImportedClaim,
  ModelProposalRecord,
  NormativeStrength,
  RedactionPolicy,
  ReviewRecord,
} from "../../src/evidence-provenance/index";

export function validEvidence(patch: Partial<EvidenceProposal> = {}): EvidenceProposal {
  return {
    id: "ev-1",
    evidenceKind: "model_output",
    sourceRef: "artifact://result-1",
    timestamp: "2024-01-01T00:00:00Z",
    sequence: 1,
    schemaVersion: "1",
    status: "verified",
    inputEvidenceRefs: ["artifact://input-1"],
    transformationRevision: "rev-7",
    sensitiveFields: [],
    ...patch,
  };
}

export function modelProposal(patch: Partial<ModelProposalRecord> = {}): ModelProposalRecord {
  return {
    proposalId: "pr-1",
    modelProvider: "joss:1",
    promptRevision: "prompt-rev-3",
    promptText: undefined,
    ...patch,
  };
}

export function reviewRecord(patch: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    reviewedRevision: "rev-7",
    action: "approve",
    reviewScope: "artifact://result-1",
    provesTruth: false,
    ...patch,
  };
}

export function redactionPolicy(patch: Partial<RedactionPolicy> = {}): RedactionPolicy {
  return {
    redactedFields: ["reviewer_note"],
    accessRestrictedFields: [],
    ...patch,
  };
}

export function importedClaim(patch: {
  evidenceClass?: EvidenceClass;
  normativeStrength?: NormativeStrength;
  standardRef?: string;
} = {}): ImportedClaim {
  const base: ImportedClaim = {
    claimId: "rc-1",
    sourceRef: "research://wanna/u08",
    evidenceClass: "empirical_evidence",
    normativeStrength: "non_normative",
  };
  // spread — not destructuring defaults — so an explicit undefined override stays undefined
  return { ...base, ...patch };
}

