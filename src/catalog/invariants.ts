// Purpose: invariant assertions for the component-catalog corpus
// Responsibilities: each declared constraint as a total predicate over a Catalog
// Rationale: one function per [[spec]] constraint, asserted at the trust boundary
import type { Catalog, GlobalLimits, RoleId, TypedSchema } from "./types";

/** [[spec.schema_mapping_explicit]] — typed input + response/event schemas per role. */
export function schemaMappingExplicit(catalog: Catalog): boolean {
  const typed = (s: TypedSchema | undefined): boolean =>
    s !== undefined && s.input.trim() !== "" && s.response.trim() !== "";
  return catalog.entries.every((e) => typed(e.schema));
}

/** [[spec.catalog_version_pinned]] — exactly one immutable, non-empty version. */
export function catalogVersionPinned(catalog: Catalog): boolean {
  return catalog.version.trim() !== "";
}

/** [[spec.roles_allowlisted]] — role id registered in the catalog. */
export function roleAllowlisted(catalog: Catalog, role: string): boolean {
  return catalog.entries.some((e) => e.role === role);
}

/** [[spec.host_capabilities_declared]] — host declared the role before selection. */
export function hostCapabilitiesDeclared(catalog: Catalog, host: string, role: string): boolean {
  return catalog.hosts.some((h) => h.host === host && h.roles.includes(role));
}

/** [[spec.fallback_graph_acyclic]] — acyclic, terminating in a registered role or "unsupported". */
export function fallbackGraphAcyclic(catalog: Catalog): boolean {
  const roles = new Set(catalog.entries.map((e) => e.role));
  const fallbackOf = new Map(catalog.entries.map((e) => [e.role, e.fallback] as const));
  for (const start of roles) {
    const seen = new Set<RoleId>();
    let current: RoleId | "unsupported" | undefined = start;
    while (typeof current === "string" && current !== "unsupported") {
      if (current !== start && !roles.has(current)) return false; // dangling
      if (seen.has(current)) return false; // cycle
      seen.add(current);
      current = fallbackOf.get(current);
    }
  }
  return true;
}

/** [[spec.limits_consistent]] — host limits never exceed global limits. */
export function limitsConsistent(catalog: Catalog, global: GlobalLimits): boolean {
  return catalog.hosts.every(
    (h) =>
      h.limits.maxPayloadBytes <= global.maxPayloadBytes &&
      h.limits.maxRoles <= global.maxRoles,
  );
}