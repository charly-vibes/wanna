// Purpose: render decision trust boundary for the component catalog
// Responsibilities: only allowlisted, host-declared roles render; result pins the version
// Rationale: [[spec.catalog_version_pinned]] + [[spec.roles_allowlisted]] + [[spec.host_capabilities_declared]]
import type { Catalog, RoleId } from "./types";
import { catalogVersionPinned, hostCapabilitiesDeclared, roleAllowlisted } from "./invariants";

export type RenderResult =
  | { readonly ok: true; readonly value: { readonly catalogVersion: string; readonly role: RoleId } }
  | { readonly ok: false; readonly reason: string };

export function renderDecision(catalog: Catalog, host: string, role: string): RenderResult {
  if (!catalogVersionPinned(catalog)) {
    return { ok: false, reason: `catalog version is not pinned (empty) for render of ${role}` };
  }
  if (!roleAllowlisted(catalog, role)) {
    return { ok: false, reason: `role ${role} is not in the allowlist` };
  }
  if (!hostCapabilitiesDeclared(catalog, host, role)) {
    return { ok: false, reason: `host ${host} did not declare role ${role}` };
  }
  return { ok: true, value: { catalogVersion: catalog.version, role } };
}