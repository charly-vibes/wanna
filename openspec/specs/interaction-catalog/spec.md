---
id: spec
kind: intent
statement: THE Interaction Catalog SHALL define the trusted interaction kinds, their response schemas, bounds, and need-to-kind eligibility mappings
---

# Trusted Interaction Catalog

The catalog is the closed, versioned registry of interaction kinds and their response semantics. It supplies trusted schemas and mappings to the policy engine. The LLM may request or propose a catalog kind, but cannot create a new kind or alter its schema. Hosts map catalog kinds to trusted renderers.

## Initial v1 interaction kinds

| Kind | Intended human contribution | Required response semantics |
|---|---|---|
| `clarify` | Provide a missing fact or resolve an ambiguity | Explicit answer payload; may support `unknown`/`not_sure` where allowed |
| `choose` | Select among a finite set of alternatives | Stable option ID(s), not display labels; cardinality declared by contract |
| `rank` | Prioritize alternatives | Ordered list of unique known option IDs; partial rankings permitted only when declared |
| `configure` | Set structured values or constraints | Field-path/value payload validated against a declared field schema |
| `review` | Inspect or correct an artifact | Explicit accept/reject/request-changes/annotation outcome as supported by that contract |
| `diagnose` | Supply observations or select evidence for a problem | Structured observations/evidence references; no inferred diagnosis is treated as established fact |
| `verify` | Check a claim, requirement, or result | Pass/fail/unknown or declared equivalent, with evidence fields when required |
| `authorize` | Approve or deny a specific action | Action/scope summary, consequences, expiry, actor authority context and explicit decision; UI visibility alone is not authorization |

A missing human contribution does not automatically imply that the catalog should render a widget. Informational updates, tasks that require no decision, and situations with no eligible interaction may return without an interaction.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| catalog_kind_set_pinned | invariant | The published catalog defines a closed, versioned set of interaction kinds; a new kind requires a catalog version change and compatibility review. | [[spec]] |
| kind_response_schema_defined | invariant | Every published kind declares its accepted response schema, required/optional fields, response outcome vocabulary, and runtime validator. | [[spec]] |
| response_uses_stable_option_ids | invariant | Choice and ranking responses refer to stable option IDs; labels are presentation-only and cannot be used as authoritative identifiers. | [[spec]] |
| bounds_defined_for_kind | invariant | Every kind defines maximum option/field counts, payload sizes, string lengths, nesting, and applicable numeric/cardinality bounds. | [[spec]] |
| need_to_kind_mapping_trusted | invariant | Need-kind to interaction-kind mappings are versioned catalog/policy data and cannot be authored or overridden by an untrusted agent proposal. | [[spec]] |
| mapping_has_valid_fallback | invariant | Each declared mapping either identifies an eligible primary kind and permitted alternatives or returns an explicit no-eligible-interaction outcome. | [[spec]] |
| authorization_scope_bound | invariant | An `authorize` contract identifies one specific action/scope and its policy context; it cannot be reused as approval for a different action, task revision, actor, or expiry window. | [[spec]] |
| host_renderer_trusted | invariant | Each published kind is bound only to registered trusted host renderers; catalog text cannot name an arbitrary module or execute presentation code. | [[spec]] |
| published_catalog_immutable | invariant | A published catalog version is immutable; changes create a new version and do not silently reinterpret active interactions. | [[spec]] |
| catalog_retirement_explicit | invariant | A published catalog version is retired only by an explicit compatibility or deprecation action; active interactions are migrated by a registered migration or retired and reissued. | [[spec]] |
| corrected_catalog_received | invariant | An invalid catalog returns to draft only after a corrected catalog definition is supplied. | [[spec]] |
| publication_approved_and_versioned | invariant | A catalog can be published only after validation, compatibility review, and assignment of an immutable version identifier. | [[spec]] |

## Model
### States
- `draft`
- `validated`
- `published`
- `invalid`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_catalog | draft | validated | [[spec.kind_response_schema_defined]] |
| reject_invalid_catalog | draft | invalid | ¬([[spec.kind_response_schema_defined]]) |
| correct_catalog | invalid | draft | [[spec.corrected_catalog_received]] |
| publish_pinned_catalog | validated | published | [[spec.publication_approved_and_versioned]] |
| retire_catalog_version | published | retired | [[spec.catalog_retirement_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| every_kind_has_response_schema | unit | [[spec.kind_response_schema_defined]] | `any::<String>()` | `TypeScript test: every published kind has schema, outcomes, required fields, and a runtime validator` |
| kind_set_requires_version_change | unit | [[spec.catalog_kind_set_pinned]] | `any::<String>()` | `TypeScript test: adding/removing/renaming a kind without a catalog version change is rejected` |
| labels_are_not_option_identity | unit | [[spec.response_uses_stable_option_ids]] | `any::<String>()` | `TypeScript test: duplicate or changed display labels do not alias stable option IDs` |
| bounds_are_declared_and_enforced | unit | [[spec.bounds_defined_for_kind]] | `any::<String>()` | `TypeScript test: missing or violated kind bounds fail catalog validation or runtime input validation` |
| mapping_is_not_agent_controlled | unit | [[spec.need_to_kind_mapping_trusted]] | `any::<String>()` | `Security test: an agent cannot add a kind or change a trusted need-to-kind mapping` |
| no_mapping_returns_explicit_result | unit | [[spec.mapping_has_valid_fallback]] | `any::<String>()` | `TypeScript test: needs with no eligible catalog mapping return no-interaction rather than an invented kind` |
| authorization_is_action_bound | unit | [[spec.authorization_scope_bound]] | `any::<String>()` | `Security test: approval for one action/revision/actor/expiry cannot authorize a different action` |
| catalog_cannot_load_arbitrary_renderer | unit | [[spec.host_renderer_trusted]] | `any::<String>()` | `Security test: unknown renderer/module names cannot trigger dynamic component resolution` |
| published_version_never_mutates | unit | [[spec.published_catalog_immutable]] | `any::<String>()` | `TypeScript test: published catalog version hash/content remains stable; edits require a new version` |
| retirement_migration_is_explicit | unit | [[spec.catalog_retirement_explicit]] | `any::<String>()` | `TypeScript test: active contracts are migrated only by a registered migration, otherwise retired and reissued` |
| invalid_catalog_requires_correction | unit | [[spec.corrected_catalog_received]] | `any::<String>()` | `TypeScript test: invalid catalog returns to draft only after a corrected definition arrives` |
| publication_requires_version_and_review | unit | [[spec.publication_approved_and_versioned]] | `any::<String>()` | `TypeScript test: catalog cannot publish without validation, compatibility review, and immutable version ID` |

## Requirements

### Requirement: Trusted Interaction Catalog declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Trusted Interaction Catalog invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.every_kind_has_response_schema]]
- **VERIFIES** [[spec.kind_set_requires_version_change]]
- **VERIFIES** [[spec.labels_are_not_option_identity]]
- **VERIFIES** [[spec.bounds_are_declared_and_enforced]]
- **VERIFIES** [[spec.mapping_is_not_agent_controlled]]
- **VERIFIES** [[spec.no_mapping_returns_explicit_result]]
- **VERIFIES** [[spec.authorization_is_action_bound]]
- **VERIFIES** [[spec.catalog_cannot_load_arbitrary_renderer]]
- **VERIFIES** [[spec.published_version_never_mutates]]
- **VERIFIES** [[spec.retirement_migration_is_explicit]]
- **VERIFIES** [[spec.invalid_catalog_requires_correction]]
- **VERIFIES** [[spec.publication_requires_version_and_review]]

#### Scenario: Violating Trusted Interaction Catalog invariant is rejected

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
