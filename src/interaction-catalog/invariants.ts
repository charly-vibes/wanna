// Purpose: catalog-level invariants and transition guards
// Responsibilities: schema validity, pinned kind set, publication approval, retirement explicitness, correction receipt, agent-proposal rejection, need-to-kind resolution
// Rationale: each guard returns a precise failure reason so negative tests can assert the exact string — no masked violations
import type {
  AgentCatalogProposal,
  CatalogDefinition,
  Check,
  CompatibilityReview,
  InteractionKind,
  KindDefinition,
  KindResolution,
  KindMapping,
  RetirementAction,
} from "./types";
import { INTERACTION_KINDS } from "./types";
import {
  CATALOG_KIND_SETS,
  REGISTERED_MIGRATIONS,
  TRUSTED_RENDERERS,
  RUNTIME_VALIDATORS,
} from "./registries";

const IMMUTABLE_VERSION_PATTERN = /^interaction-catalog-\d+\.\d+\.\d+$/;

export const AGENT_PROPOSAL_REASON =
  "agent proposal rejected: the kind set and need-to-kind mappings are versioned catalog data and cannot be authored or overridden by an untrusted agent proposal";

export function kindSetPinned(def: CatalogDefinition): Check {
  const pinned = CATALOG_KIND_SETS[def.version];
  if (!pinned) return kindVocabularyClosed(def);
  return pinnedSetMatches(def, pinned);
}

function kindVocabularyClosed(def: CatalogDefinition): Check {
  for (const kd of def.kinds) {
    if (!(INTERACTION_KINDS as readonly string[]).includes(kd.kind)) {
      return { ok: false, reason: `catalog_kind_set_pinned does not hold: "${kd.kind}" is not a known interaction kind` };
    }
  }
  return { ok: true };
}

function pinnedSetMatches(def: CatalogDefinition, pinned: readonly InteractionKind[]): Check {
  const have = def.kinds.map((k) => k.kind).sort();
  const want = [...pinned].sort();
  if (have.length === want.length && have.every((k, i) => k === want[i])) return { ok: true };
  return {
    ok: false,
    reason: `catalog_kind_set_pinned does not hold: version "${def.version}" pins a different kind set; adding, removing, or renaming kinds requires a new catalog version and compatibility review`,
  };
}

function kindDefinitionCheck(kd: KindDefinition): Check {
  if (kd.outcomes.length === 0) {
    return { ok: false, reason: `kind_response_schema_defined does not hold: kind "${kd.kind}" declares no outcome vocabulary` };
  }
  if (!(kd.kind in RUNTIME_VALIDATORS)) {
    return { ok: false, reason: `kind_response_schema_defined does not hold: kind "${kd.kind}" has no runtime validator` };
  }
  if (!kd.bounds) {
    return { ok: false, reason: `bounds_defined_for_kind does not hold: kind "${kd.kind}" declares no bounds` };
  }
  if (!TRUSTED_RENDERERS.includes(kd.renderer)) {
    return { ok: false, reason: `host_renderer_trusted does not hold: kind "${kd.kind}" names unregistered renderer "${kd.renderer}"` };
  }
  return { ok: true };
}

function kindsCheck(def: CatalogDefinition): Check {
  for (const kd of def.kinds) {
    const check = kindDefinitionCheck(kd);
    if (!check.ok) return check;
  }
  return { ok: true };
}

function mappingCheck(mapping: KindMapping, def: CatalogDefinition): Check {
  if (mapping.primary === null && mapping.alternatives.length > 0) {
    return { ok: false, reason: `mapping_has_valid_fallback does not hold: mapping for need "${mapping.needKind}" has alternatives without a primary kind` };
  }
  const declared = new Set(def.kinds.map((k) => k.kind));
  for (const candidate of [mapping.primary, ...mapping.alternatives]) {
    if (candidate !== null && !declared.has(candidate)) {
      return { ok: false, reason: `mapping_has_valid_fallback does not hold: mapping for need "${mapping.needKind}" names unknown interaction kind "${candidate}"` };
    }
  }
  return { ok: true };
}

function mappingsCheck(def: CatalogDefinition): Check {
  for (const mapping of def.mappings) {
    const check = mappingCheck(mapping, def);
    if (!check.ok) return check;
  }
  return { ok: true };
}

export function catalogSchemaValid(def: CatalogDefinition): Check {
  const pinned = kindSetPinned(def);
  if (!pinned.ok) return pinned;
  const kinds = kindsCheck(def);
  if (!kinds.ok) return kinds;
  return mappingsCheck(def);
}

export function publicationApproved(def: CatalogDefinition, review?: CompatibilityReview): Check {
  if (!review) {
    return { ok: false, reason: "publication_approved_and_versioned does not hold: no compatibility review recorded" };
  }
  if (!review.approved) {
    return { ok: false, reason: "publication_approved_and_versioned does not hold: compatibility review was not approved" };
  }
  if (!IMMUTABLE_VERSION_PATTERN.test(def.version)) {
    return { ok: false, reason: `publication_approved_and_versioned does not hold: "${def.version}" is not an immutable version identifier` };
  }
  const schema = catalogSchemaValid(def);
  if (!schema.ok) return schema;
  return { ok: true };
}

export function retirementExplicit(action?: RetirementAction): Check {
  const registered = action?.migration !== undefined && action.migration in REGISTERED_MIGRATIONS;
  if (!registered && action?.reissueVersion === undefined) {
    return { ok: false, reason: "catalog_retirement_explicit does not hold: retirement requires a registered migration or an explicit reissue version" };
  }
  return { ok: true };
}

export function correctedCatalogReceived(next?: CatalogDefinition): Check {
  if (!next) {
    return { ok: false, reason: "corrected_catalog_received does not hold: no corrected catalog definition supplied" };
  }
  return { ok: true };
}

export function applyAgentProposal(def: CatalogDefinition, proposal: AgentCatalogProposal): Check {
  void def;
  void proposal;
  return { ok: false, reason: AGENT_PROPOSAL_REASON };
}

export function resolveKindForNeed(def: CatalogDefinition, needKind: string): KindResolution {
  const mapping = def.mappings.find((m) => m.needKind === needKind);
  if (mapping && mapping.primary !== null) return { ok: true, kind: mapping.primary };
  return { ok: false, outcome: "no_eligible_interaction" };
}