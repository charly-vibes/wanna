// Purpose: invariants and guards for the contribution-primitives layer
// Responsibilities: semantic atomicity, typed-event validity, explicit escape semantics, versioned taxonomy, authority separation, host realization, need-to-primitive policy
// Rationale: each guard returns a precise failure reason so negative tests can assert the exact string
import type {
  Check,
  EscapeDeclaration,
  EscapeOutcome,
  PrimitiveDraft,
  PrimitiveEvent,
  PrimitiveKind,
  PrimitiveProposal,
} from "./types";
import {
  COMPOUND_ACTIVITIES,
  ESCAPE_EFFECTS,
  ESCAPE_OUTCOMES,
  PRIMITIVE_KINDS,
  TAXONOMY_VERSION,
} from "./types";

export type { Check } from "./types";
export {
  COMPOUND_ACTIVITIES,
  ESCAPE_EFFECTS,
  ESCAPE_OUTCOMES,
  PRIMITIVE_KINDS,
  TAXONOMY_VERSION,
} from "./types";

export const PRESENTATION_VOCABULARY: readonly string[] = [
  "button", "dropdown", "modal", "widget", "layout", "grid", "flexbox",
  "css", "dom", "aria", "renderer", "component", "screen", "toast",
  "dialog", "tooltip", "animation", "radio-group", "menu", "text box",
];

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

export function primitiveNotPresentation(kind: string): boolean {
  return scanPresentation([kind]).length === 0;
}

export function semanticallyAtomic(kind: string): Check {
  const leaks = scanPresentation([kind]);
  if (leaks.length > 0) {
    return { ok: false, reason: `presentation vocabulary in primitive identity: ${leaks.join(", ")}` };
  }
  if ((COMPOUND_ACTIVITIES as readonly string[]).includes(kind)) {
    return {
      ok: false,
      reason: `compound activity ${kind} is an interaction pattern, not a single primitive — split it into primitives or revise the taxonomy explicitly`,
    };
  }
  if (!(PRIMITIVE_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, reason: `unsupported primitive kind: ${kind} (taxonomy ${TAXONOMY_VERSION})` };
  }
  return { ok: true };
}

export function rejectInvalidPrimitive(kind: string): Check {
  return semanticallyAtomic(kind).ok
    ? { ok: false, reason: "reject_invalid_primitive requires an invalid primitive" }
    : { ok: true };
}

function eventFieldCheck(draft: PrimitiveDraft, requirePayload: boolean): Check {
  if (draft.interactionId === undefined || draft.interactionId.length === 0) {
    return { ok: false, reason: "primitive event requires an interaction identity" };
  }
  if (draft.taskRevision === undefined || draft.taskRevision.length === 0) {
    return { ok: false, reason: "primitive event requires a task revision" };
  }
  if (requirePayload && draft.payload === undefined) {
    return { ok: false, reason: "primitive event requires a response payload" };
  }
  if (!Array.isArray(draft.provenance) || draft.provenance.length === 0) {
    return { ok: false, reason: "primitive event requires provenance" };
  }
  return { ok: true };
}

export function primitiveEventValid(draft: PrimitiveDraft, requirePayload = true): Check {
  const known = interpretPrimitive(draft.kind, TAXONOMY_VERSION);
  if (!known.ok) return known;
  const fields = eventFieldCheck(draft, requirePayload);
  if (!fields.ok) return fields;
  const leaks = scanPresentation([draft.interactionId]);
  if (!primitiveNotPresentation(draft.kind) || leaks.length > 0) {
    return {
      ok: false,
      reason: leaks.length > 0
        ? `presentation vocabulary in primitive event: ${leaks.join(", ")}`
        : `presentation vocabulary in primitive identity: ${scanPresentation([draft.kind]).join(", ")}`,
    };
  }
  return { ok: true };
}

export function primitiveEventTyped(proposal: PrimitiveProposal, requirePayload: boolean): Check {
  return primitiveEventValid(
    {
      kind: proposal.kind,
      interactionId: proposal.interactionId,
      taskRevision: proposal.taskRevision,
      payload: proposal.responsePayload,
      provenance: proposal.provenance,
    },
    requirePayload,
  );
}

export function defaultEscapeDeclaration(): Required<EscapeDeclaration> {
  return { ...ESCAPE_EFFECTS };
}

export function escapeSemanticsExplicit(
  proposal: PrimitiveProposal,
  outcome: EscapeOutcome | undefined,
): Check {
  if (outcome === undefined || !(ESCAPE_OUTCOMES as readonly string[]).includes(outcome)) {
    return {
      ok: false,
      reason: `guard escape_semantics_explicit does not hold: ${outcome === undefined ? "no escape outcome supplied" : `escape outcome ${outcome} is not a valid escape outcome`}`,
    };
  }
  const declaration: EscapeDeclaration = proposal.escapeDeclaration ?? defaultEscapeDeclaration();
  const effect = declaration[outcome];
  if (effect === undefined) {
    return {
      ok: false,
      reason: `guard escape_semantics_explicit does not hold: escape outcome ${outcome} is not declared for kind ${proposal.kind}`,
    };
  }
  return { ok: true };
}

export function taxonomyVersionedRetirement(taxonomyRevision: string | undefined): Check {
  if (typeof taxonomyRevision !== "string" || taxonomyRevision.length === 0) {
    return {
      ok: false,
      reason: "guard primitive_taxonomy_versioned does not hold: retirement requires an explicit taxonomy revision",
    };
  }
  return { ok: true };
}

export function interpretPrimitive(kind: string, taxonomyVersion: string): Check {
  if (taxonomyVersion !== TAXONOMY_VERSION) {
    return {
      ok: false,
      reason: `primitive taxonomy version ${taxonomyVersion} is not recognized; identifiers are interpreted under ${TAXONOMY_VERSION}`,
    };
  }
  if (!(PRIMITIVE_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, reason: `unsupported primitive kind: ${kind} (taxonomy ${TAXONOMY_VERSION})` };
  }
  return { ok: true };
}

export interface AuthorityGrant {
  readonly interactionId: string;
  readonly kind: string;
}

export interface AuthorityState {
  readonly grants: readonly AuthorityGrant[];
}

export function authorizeGuardSatisfied(
  event: { readonly kind: string; readonly interactionId: string },
  grants: readonly AuthorityGrant[],
): Check {
  if (event.kind === "verify") {
    return {
      ok: false,
      reason: "verification_distinct_from_authorization: a verify event cannot satisfy an authorize guard; policy must separately require and record both semantics",
    };
  }
  if (event.kind !== "authorize") {
    return {
      ok: false,
      reason: `kind ${event.kind} does not grant authority; only authorize events with an applicable grant satisfy an authorize guard`,
    };
  }
  const matched = grants.some((g) => g.kind === "authorize" && g.interactionId === event.interactionId);
  if (!matched) {
    return {
      ok: false,
      reason: "primitive_not_authority: emitting an authorize event does not create authority; no applicable authority grant",
    };
  }
  return { ok: true };
}

export function emitEvent(state: AuthorityState, event: PrimitiveEvent): AuthorityState {
  void event;
  return state;
}

export const NEED_TO_PRIMITIVES_POLICY: Readonly<Record<string, readonly PrimitiveKind[]>> = {
  review_artifact: ["inspect", "evaluate", "verify"],
  clarify_intent: ["express"],
  provide_evidence: ["provide", "annotate"],
  escalate: ["interrupt", "delegate"],
  approve: ["authorize"],
  reject: ["reject"],
};

export function eligiblePrimitives(needKind: string): readonly PrimitiveKind[] {
  return NEED_TO_PRIMITIVES_POLICY[needKind] ?? [];
}

export type Host = "web" | "tui";

export interface Realization {
  readonly host: Host;
  readonly control: string;
  readonly kind: PrimitiveKind;
  readonly responseSemantics: string;
}

export function realize(
  realization: Realization,
): { readonly kind: PrimitiveKind; readonly responseSemantics: string } {
  return { kind: realization.kind, responseSemantics: realization.responseSemantics };
}