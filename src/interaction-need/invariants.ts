// Purpose: invariants for the interaction-need normalizer
// Responsibilities: schema validity, single-immediate-target, presentation-freedom, retry-change guard
// Rationale: each invariant returns a precise failure reason so negative tests can assert it
import type { NeedProposal, UnresolvedNeed } from "./types";

import { NEED_KINDS } from "./types";
export { NEED_KINDS, TAXONOMY_VERSION } from "./types";

export const PRESENTATION_VOCABULARY: readonly string[] = [
  "button", "dropdown", "modal", "widget", "layout", "grid", "flexbox",
  "css", "dom", "aria", "renderer", "component", "screen", "toast",
  "dialog", "tooltip", "animation",
];

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

function scanPresentation(fields: readonly unknown[]): string[] {
  const hits: string[] = [];
  for (const field of fields) {
    if (typeof field !== "string") continue;
    const lower = field.toLowerCase();
    for (const token of PRESENTATION_VOCABULARY) {
      if (lower.includes(token)) hits.push(token);
    }
  }
  return [...new Set(hits)];
}

export function needNotPresentation(proposal: NeedProposal): boolean {
  return scanPresentation([proposal.kind, proposal.target, proposal.taskRevision, proposal.proposalId]).length === 0;
}

function needShapeValid(proposal: NeedProposal): Check {
  if (typeof proposal.kind !== "string" || proposal.kind.length === 0) {
    return { ok: false, reason: "missing need kind" };
  }
  if (!(NEED_KINDS as readonly string[]).includes(proposal.kind)) {
    return { ok: false, reason: `unsupported need kind: ${proposal.kind}` };
  }
  if (proposal.target === undefined) return { ok: false, reason: "missing target" };
  if (Array.isArray(proposal.target)) {
    return {
      ok: false,
      reason: "a need identifies exactly one immediate participation bottleneck; independent gaps must be represented as separate needs",
    };
  }
  if (typeof proposal.target !== "string" || proposal.target.length === 0) {
    return { ok: false, reason: "target must be a non-empty string" };
  }
  return { ok: true };
}

function needProvenanceValid(proposal: NeedProposal): Check {
  if (typeof proposal.taskRevision !== "string" || proposal.taskRevision.length === 0) {
    return { ok: false, reason: "missing task revision" };
  }
  if (typeof proposal.proposalId !== "string" || proposal.proposalId.length === 0) {
    return { ok: false, reason: "missing proposal identity" };
  }
  if (!Array.isArray(proposal.evidenceRefs)) {
    return { ok: false, reason: "missing evidence references" };
  }
  return { ok: true };
}

export function needSchemaValid(proposal: NeedProposal): Check {
  const shape = needShapeValid(proposal);
  if (!shape.ok) return shape;
  const provenance = needProvenanceValid(proposal);
  if (!provenance.ok) return provenance;
  const leaks = scanPresentation([proposal.target]);
  if (leaks.length > 0) {
    return { ok: false, reason: `presentation vocabulary in need record: ${leaks.join(", ")}` };
  }
  return { ok: true };
}

export function needTargetImmediate(proposal: NeedProposal): boolean {
  return proposal.evidenceStrength === "sufficient";
}

export function unresolvedRequiresChange(record: UnresolvedNeed, next: NeedProposal): Check {
  const changed =
    next.taskRevision !== record.taskRevision ||
    next.kind !== record.kind ||
    next.target !== record.target ||
    next.evidenceRefs.some((ref) => !record.evidenceRefs.includes(ref));
  if (changed) return { ok: true };
  return {
    ok: false,
    reason: "unresolved_requires_change does not hold: no semantic change (confidence and proposal identity are not changes)",
  };
}
