---
id: spec
kind: intent
statement: THE Trusted Component Catalog SHALL map semantic interaction roles to bounded host-renderable component capabilities
---

# Trusted Component Catalog

The catalog is a versioned allowlist and compatibility boundary. It defines the component roles available to each host, supported input/output semantics, limits, accessibility behavior, and fallback relationships. Agents can request semantic roles but cannot register arbitrary renderer code through ordinary interaction proposals.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| catalog_version_pinned | invariant | Every render decision pins one immutable component-catalog version and records it in the render result. | [[spec]] |
| roles_allowlisted | invariant | Only registered semantic roles can be rendered. | [[spec]] |
| host_capabilities_declared | invariant | Each host declares supported roles and limits before policy selects a host-specific presentation. | [[spec]] |
| schema_mapping_explicit | invariant | Each component role declares a typed input schema and typed response/event schema. | [[spec]] |
| fallback_graph_acyclic | invariant | Fallback mappings form an acyclic graph and terminate in a supported role or explicit unsupported result. | [[spec]] |
| catalog_changes_reviewed | invariant | Catalog registration or removal is a versioned trusted change, not a model-controlled runtime mutation. | [[spec]] |
| limits_consistent | invariant | Host-specific limits cannot exceed the global security and interaction-contract limits. | [[spec]] |

## Model
### States
- `draft`
- `validated`
- `published`
- `deprecated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_catalog | draft | validated | [[spec.schema_mapping_explicit]] |
| reject_catalog | draft | deprecated | ¬([[spec.schema_mapping_explicit]]) |
| publish_catalog | validated | published | [[spec.catalog_version_pinned]] |
| deprecate_catalog | published | deprecated | [[spec.catalog_changes_reviewed]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| catalog_version_pinned_holds | unit | [[spec.catalog_version_pinned]] | `any::<String>()` | `TypeScript conformance test: assert invariant catalog_version_pinned at its trust boundary and under its stated edge cases.` |
| roles_allowlisted_holds | unit | [[spec.roles_allowlisted]] | `any::<String>()` | `TypeScript conformance test: assert invariant roles_allowlisted at its trust boundary and under its stated edge cases.` |
| host_capabilities_declared_holds | unit | [[spec.host_capabilities_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant host_capabilities_declared at its trust boundary and under its stated edge cases.` |
| schema_mapping_explicit_holds | unit | [[spec.schema_mapping_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant schema_mapping_explicit at its trust boundary and under its stated edge cases.` |
| fallback_graph_acyclic_holds | unit | [[spec.fallback_graph_acyclic]] | `any::<String>()` | `TypeScript conformance test: assert invariant fallback_graph_acyclic at its trust boundary and under its stated edge cases.` |
| catalog_changes_reviewed_holds | unit | [[spec.catalog_changes_reviewed]] | `any::<String>()` | `TypeScript conformance test: assert invariant catalog_changes_reviewed at its trust boundary and under its stated edge cases.` |
| limits_consistent_holds | unit | [[spec.limits_consistent]] | `any::<String>()` | `TypeScript conformance test: assert invariant limits_consistent at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Trusted Component Catalog model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-catalog moves `draft` to `validated`
- **WHEN** the model is in the `draft` state and the `validate_catalog` transition guard holds ([[spec.schema_mapping_explicit]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.schema_mapping_explicit_holds]]

#### Scenario: reject-catalog moves `draft` to `deprecated`
- **WHEN** the model is in the `draft` state and the `reject_catalog` transition guard evaluates false (¬([[spec.schema_mapping_explicit]]))
- **THEN** the model enters the `deprecated` state and records the transition
- **VERIFIES** [[spec.schema_mapping_explicit_holds]]

#### Scenario: publish-catalog moves `validated` to `published`
- **WHEN** the model is in the `validated` state and the `publish_catalog` transition guard holds ([[spec.catalog_version_pinned]])
- **THEN** the model enters the `published` state and records the transition
- **VERIFIES** [[spec.catalog_version_pinned_holds]]

#### Scenario: deprecate-catalog moves `published` to `deprecated`
- **WHEN** the model is in the `published` state and the `deprecate_catalog` transition guard holds ([[spec.catalog_changes_reviewed]])
- **THEN** the model enters the `deprecated` state and records the transition
- **VERIFIES** [[spec.catalog_changes_reviewed_holds]]

#### Scenario: roles-allowlisted invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Only registered semantic roles can be rendered."
- **VERIFIES** [[spec.roles_allowlisted_holds]]

#### Scenario: host-capabilities-declared invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Each host declares supported roles and limits before policy selects a host-specific presentation."
- **VERIFIES** [[spec.host_capabilities_declared_holds]]

#### Scenario: fallback-graph-acyclic invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Fallback mappings form an acyclic graph and terminate in a supported role or explicit unsupported result."
- **VERIFIES** [[spec.fallback_graph_acyclic_holds]]

#### Scenario: limits-consistent invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Host-specific limits cannot exceed the global security and interaction-contract limits."
- **VERIFIES** [[spec.limits_consistent_holds]]

#### Scenario: Violating Trusted Component Catalog invariant is rejected

- **WHEN** a revision drops a declared property, breaks a deriving link, or leaves a constraint uncovered
- **THEN** the revision is rejected by the conformance gate with a finding naming the violated row, and no partial deploy occurs
## Non-Goals

- Concrete host presentation — widget choice, layout, visual styling, and
  component-library specifics — is out of scope; this specification governs
  interaction semantics, not implementation.
- Runtime performance, storage formats, and host adapter mechanics are
  governed by their own specifications and are not restated here.
- Empirical human usability validation is out of scope; conformance here is
  structural and behavioral, not user-research evidence.
