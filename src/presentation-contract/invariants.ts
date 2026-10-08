// Purpose: invariants for the presentation-contract layer
// Responsibilities: semantic_role_required, host_component_names_forbidden, content_hierarchy_explicit, density_bounded, untrusted_text_inert
// Rationale: each invariant returns a precise failure reason so negative tests can assert it
import type { CatalogLimits, PresentationContract, PresentationView, ViewItem } from "./types";
import { DENSITY_CATALOG, SEMANTIC_COMPONENT_ROLES, SEMANTIC_ROLES } from "./types";
import { countItems, contentSize, depthOf } from "./view";

export {
  DENSITY_CATALOG,
  DENSITY_LEVELS,
  FALLBACK_KINDS,
  SEMANTIC_COMPONENT_ROLES,
  SEMANTIC_ROLES,
} from "./types";

export interface Check {
  readonly ok: boolean;
  readonly reason?: string;
}

const HOST_REFERENCE_PATTERN = /[/]|\.(tsx?|jsx?)$|https?:|require\(|=>/;

export function semanticRoleRequired(contract: PresentationContract): Check {
  if (contract.role === undefined || contract.role === "") {
    return { ok: false, reason: "missing semantic role" };
  }
  if (!(SEMANTIC_ROLES as readonly string[]).includes(contract.role)) {
    return { ok: false, reason: `unsupported semantic role: ${contract.role}` };
  }
  return { ok: true };
}

export function hostComponentNamesForbidden(contract: PresentationContract): Check {
  for (const component of contract.components ?? []) {
    if (HOST_REFERENCE_PATTERN.test(component)) {
      return { ok: false, reason: `forbidden host reference in component role: ${component}` };
    }
    if (!(SEMANTIC_COMPONENT_ROLES as readonly string[]).includes(component)) {
      return { ok: false, reason: `unsupported component role: ${component}` };
    }
  }
  return { ok: true };
}

export function contentHierarchyExplicit(contract: PresentationContract): Check {
  if (contract.primaryTask === undefined) return { ok: false, reason: "missing primary task" };
  if (contract.supportingContext === undefined) {
    return { ok: false, reason: "missing supporting context field" };
  }
  if (contract.optionalDetail === undefined) {
    return { ok: false, reason: "missing optional detail field" };
  }
  if (contract.actions === undefined) return { ok: false, reason: "missing available actions field" };
  return { ok: true };
}

export function densityBounded(
  view: PresentationView,
  catalog: CatalogLimits = DENSITY_CATALOG,
): Check {
  if (!(catalog.densityLevels as readonly string[]).includes(view.density)) {
    return { ok: false, reason: `density level ${view.density} is not in the catalog` };
  }
  return densityWithinLimits(view.items, catalog);
}

function densityWithinLimits(items: readonly ViewItem[], catalog: CatalogLimits): Check {
  const itemCount = countItems(items);
  if (itemCount > catalog.maxItems) {
    return { ok: false, reason: `item count ${itemCount} exceeds catalog limit ${catalog.maxItems}` };
  }
  const depth = depthOf(items);
  if (depth > catalog.maxNestingDepth) {
    return { ok: false, reason: `nesting depth ${depth} exceeds catalog limit ${catalog.maxNestingDepth}` };
  }
  const size = contentSize(items);
  if (size > catalog.maxContentChars) {
    return { ok: false, reason: `content size ${size} exceeds catalog limit ${catalog.maxContentChars}` };
  }
  return { ok: true };
}

export const MARKUP_SIGNATURES: readonly string[] = [
  "<script", "<iframe", "onerror=", "javascript:", "${", "<%", "%>",
];

export function untrustedTextInert(texts: readonly string[]): Check {
  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const signature of MARKUP_SIGNATURES) {
      if (lower.includes(signature)) {
        return { ok: false, reason: `untrusted text contains markup or executable content (${signature}` };
      }
    }
  }
  return { ok: true };
}