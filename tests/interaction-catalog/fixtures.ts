// Purpose: test fixtures for the interaction-catalog machine
// Responsibilities: build the canonical v1 catalog definition and the invalid variants the corpus properties name
// Rationale: single source of shared catalog vocabulary for transitions and properties tests
import type {
  CatalogDefinition,
  CompatibilityReview,
  InteractionKind,
  KindDefinition,
  KindMapping,
  RetirementAction,
} from "../../src/interaction-catalog/types";
import { INTERACTION_KINDS } from "../../src/interaction-catalog/types";

export const V1 = "interaction-catalog-1.0.0";

function kindDef(kind: string, overrides: Partial<KindDefinition> = {}): KindDefinition {
  return {
    kind: kind as InteractionKind,
    requiredFields: ["decision"],
    optionalFields: [],
    outcomes: ["decided"],
    bounds: { maxPayloadBytes: 4096, maxStringLength: 512, maxNesting: 2 },
    renderer: `host:${kind}`,
    ...overrides,
  };
}

function mapping(needKind: string, primary: string, ...alternatives: string[]): KindMapping {
  return { needKind, primary: primary as KindMapping["primary"], alternatives: alternatives as KindMapping["alternatives"] };
}

const NO_ELIGIBLE: readonly KindMapping[] = [
  mapping("delegate", ""),
  mapping("escalate", ""),
  mapping("create", ""),
  mapping("acknowledge", ""),
].map((m) => ({ ...m, primary: null }));

export function v1Catalog(): CatalogDefinition {
  return {
    version: V1,
    kinds: [
      kindDef("clarify", {
        requiredFields: ["answer"],
        optionalFields: ["uncertain"],
        outcomes: ["answered", "unknown"],
        renderer: "host:clarify-form",
      }),
      kindDef("choose", {
        requiredFields: ["selected"],
        outcomes: ["selected", "abstained"],
        bounds: { maxOptions: 8, maxPayloadBytes: 4096, maxStringLength: 256, maxNesting: 2 },
        renderer: "host:choice-list",
      }),
      kindDef("rank", {
        requiredFields: ["order"],
        outcomes: ["ranked", "abstained"],
        bounds: { maxOptions: 8, maxPayloadBytes: 4096, maxStringLength: 256, maxNesting: 2 },
        renderer: "host:rank-list",
      }),
      kindDef("configure", {
        requiredFields: ["values"],
        outcomes: ["configured"],
        bounds: { maxFields: 16, maxPayloadBytes: 8192, maxStringLength: 512, maxNesting: 3 },
        renderer: "host:field-editor",
      }),
      kindDef("review", {
        outcomes: ["accepted", "rejected", "changes_requested"],
        bounds: { maxPayloadBytes: 16384, maxStringLength: 2048, maxNesting: 3 },
        renderer: "host:artifact-review",
      }),
      kindDef("diagnose", {
        requiredFields: ["observations"],
        optionalFields: ["evidenceRefs"],
        outcomes: ["observed"],
        bounds: { maxFields: 16, maxPayloadBytes: 8192, maxStringLength: 1024, maxNesting: 3 },
        renderer: "host:evidence-panel",
      }),
      kindDef("verify", {
        requiredFields: ["verdict"],
        optionalFields: ["evidenceRefs"],
        outcomes: ["passed", "failed", "unknown"],
        renderer: "host:claim-check",
      }),
      kindDef("authorize", {
        outcomes: ["approved", "denied"],
        renderer: "host:authorize-consent",
      }),
    ],
    mappings: [
      mapping("clarify_intent", "clarify"),
      mapping("choose", "choose", "rank"),
      mapping("approve", "authorize"),
      mapping("authorize", "authorize"),
      mapping("review_artifact", "review", "diagnose"),
      mapping("inspect", "diagnose"),
      mapping("provide_evidence", "diagnose", "verify"),
      mapping("reject", "review"),
      mapping("confirm", "verify"),
      mapping("classify", "configure", "choose"),
      mapping("correct", "configure", "review"),
      mapping("annotate", "review"),
      ...NO_ELIGIBLE,
    ],
  };
}

export function withoutKind(def: CatalogDefinition, kind: string): CatalogDefinition {
  return { ...def, kinds: def.kinds.filter((k) => k.kind !== kind) };
}

export function renameKind(def: CatalogDefinition, from: string, to: string): CatalogDefinition {
  return {
    ...def,
    kinds: def.kinds.map((k) => (k.kind === from ? { ...k, kind: to as KindDefinition["kind"] } : k)),
  };
}

export function withExtraKind(def: CatalogDefinition, kind: string): CatalogDefinition {
  return { ...def, kinds: [...def.kinds, kindDef(kind)] };
}

export function withoutBounds(def: CatalogDefinition, kind: string): CatalogDefinition {
  return {
    ...def,
    kinds: def.kinds.map((k) => (k.kind === kind ? { ...k, bounds: undefined as never } : k)),
  };
}

export function withRenderer(def: CatalogDefinition, kind: string, renderer: string): CatalogDefinition {
  return {
    ...def,
    kinds: def.kinds.map((k) => (k.kind === kind ? { ...k, renderer: renderer as KindDefinition["renderer"] } : k)),
  };
}

export function approvedReview(): CompatibilityReview {
  return { reviewer: "compat-board", approved: true };
}

export function rejectedReview(): CompatibilityReview {
  return { reviewer: "compat-board", approved: false };
}

export function reissueRetirement(): RetirementAction {
  return { reason: "superseded by v2", reissueVersion: "interaction-catalog-2.0.0" };
}

export const ALL_KINDS: readonly string[] = INTERACTION_KINDS;