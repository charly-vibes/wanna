---
id: component.catalog
kind: intent
statement: THE Trusted Component Catalog SHALL map semantic interaction roles to bounded host-renderable component capabilities
---

# Trusted Component Catalog

The catalog is a versioned allowlist and compatibility boundary. It defines the component roles available to each host, supported input/output semantics, limits, accessibility behavior, and fallback relationships. Agents can request semantic roles but cannot register arbitrary renderer code through ordinary interaction proposals.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| catalog_version_pinned | invariant | Every render decision pins one immutable component-catalog version and records it in the render result. | [[component.catalog]] |
| roles_allowlisted | invariant | Only registered semantic roles can be rendered. | [[component.catalog]] |
| host_capabilities_declared | invariant | Each host declares supported roles and limits before policy selects a host-specific presentation. | [[component.catalog]] |
| schema_mapping_explicit | invariant | Each component role declares a typed input schema and typed response/event schema. | [[component.catalog]] |
| fallback_graph_acyclic | invariant | Fallback mappings form an acyclic graph and terminate in a supported role or explicit unsupported result. | [[component.catalog]] |
| catalog_changes_reviewed | invariant | Catalog registration or removal is a versioned trusted change, not a model-controlled runtime mutation. | [[component.catalog]] |
| limits_consistent | invariant | Host-specific limits cannot exceed the global security and interaction-contract limits. | [[component.catalog]] |

## Model
### States
- `draft`
- `validated`
- `published`
- `deprecated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_catalog | draft | validated | [[component.catalog.schema_mapping_explicit]] |
| reject_catalog | draft | deprecated | ¬([[component.catalog.schema_mapping_explicit]]) |
| publish_catalog | validated | published | [[component.catalog.catalog_version_pinned]] |
| deprecate_catalog | published | deprecated | [[component.catalog.catalog_changes_reviewed]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| catalog_version_pinned_holds | unit | [[component.catalog.catalog_version_pinned]] | `any::<String>()` | `TypeScript conformance test: assert invariant catalog_version_pinned at its trust boundary and under its stated edge cases.` |
| roles_allowlisted_holds | unit | [[component.catalog.roles_allowlisted]] | `any::<String>()` | `TypeScript conformance test: assert invariant roles_allowlisted at its trust boundary and under its stated edge cases.` |
| host_capabilities_declared_holds | unit | [[component.catalog.host_capabilities_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant host_capabilities_declared at its trust boundary and under its stated edge cases.` |
| schema_mapping_explicit_holds | unit | [[component.catalog.schema_mapping_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant schema_mapping_explicit at its trust boundary and under its stated edge cases.` |
| fallback_graph_acyclic_holds | unit | [[component.catalog.fallback_graph_acyclic]] | `any::<String>()` | `TypeScript conformance test: assert invariant fallback_graph_acyclic at its trust boundary and under its stated edge cases.` |
| catalog_changes_reviewed_holds | unit | [[component.catalog.catalog_changes_reviewed]] | `any::<String>()` | `TypeScript conformance test: assert invariant catalog_changes_reviewed at its trust boundary and under its stated edge cases.` |
| limits_consistent_holds | unit | [[component.catalog.limits_consistent]] | `any::<String>()` | `TypeScript conformance test: assert invariant limits_consistent at its trust boundary and under its stated edge cases.` |
