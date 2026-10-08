// Purpose: non-deceptive user-facing failure status rendering
// Responsibilities: renderFailureStatus — four segments distinguishing known, failed, may-have-succeeded, uncertain
// Rationale: a lost acknowledgement never renders as a definite effect failure or a definite effect success
import type { FailureAssessment, FailureRecord } from "./types";

export interface FailureStatus {
  /** What is known: containment, class, scope, and the declared effect certainty. */
  readonly known: readonly string[];
  /** What failed — without claiming the external effect failed while its state is unknown. */
  readonly failed: readonly string[];
  /** What may have succeeded — an unknown outcome may yet have applied its effect. */
  readonly mayHaveSucceeded: readonly string[];
  /** What remains uncertain until reconciliation supplies evidence. */
  readonly uncertain: readonly string[];
}

function knownSegment(record: FailureRecord, a: FailureAssessment): string[] {
  return [
    `failure ${record.failureId} of class ${record.failureClass} is contained`,
    `the declared effect certainty is ${a.effectCertainty}`,
  ];
}

function failedSegment(record: FailureRecord, a: FailureAssessment): string[] {
  if (a.effectCertainty === "effect_unknown") {
    return [
      record.mutating
        ? "the mutating request did not receive an acknowledgement"
        : "the operation did not complete normally",
    ];
  }
  return [`the operation failed with effect certainty ${a.effectCertainty}`];
}

function mayHaveSucceededSegment(a: FailureAssessment): string[] {
  if (a.effectCertainty !== "effect_unknown") return [];
  return ["the external effect may have applied — loss of acknowledgement does not prove it did not occur"];
}

function uncertainSegment(a: FailureAssessment): string[] {
  if (a.effectCertainty !== "effect_unknown") return [];
  return ["the effect outcome is unknown until reconciliation supplies evidence"];
}

export function renderFailureStatus(record: FailureRecord, a: FailureAssessment): FailureStatus {
  return {
    known: knownSegment(record, a),
    failed: failedSegment(record, a),
    mayHaveSucceeded: mayHaveSucceededSegment(a),
    uncertain: uncertainSegment(a),
  };
}
