---
id: spec
kind: intent
statement: THE Interaction Contract Layer SHALL validate versioned interaction descriptions before they are eligible for rendering
---

# Interaction Contract Layer

An interaction contract is a serializable, non-executable description of a request for human contribution. It must define an allowlisted kind, purpose, bounded payload, declared response shape, identity and version. A host renders the validated description through known components; the contract is not arbitrary UI code.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| contract_has_identity_and_version | invariant | Every contract has a stable interaction ID, contract-schema version, interaction revision, task ID, and task revision precondition. | [[spec]] |
| contract_kind_allowlisted | invariant | Every contract kind is present in the pinned host-neutral catalog; unknown kinds are rejected without dynamic imports or implicit fallback. | [[spec]] |
| contract_payload_valid | invariant | Contract data validates against the schema registered for its declared kind, including required fields and response schema. | [[spec]] |
| contract_has_bounded_content | invariant | Labels, descriptions, option counts, option values, numeric bounds, and serialized payload size obey catalog-defined limits. | [[spec]] |
| contract_is_data_only | invariant | A contract contains no executable scripts, event-handler code, arbitrary component names, untrusted HTML, or host-evaluated expressions. | [[spec]] |
| response_correlated | invariant | Every accepted response preserves interaction ID, contract version, interaction revision, task revision precondition, and a unique event ID. | [[spec]] |
| contract_version_migration_explicit | invariant | A contract with an unsupported schema version is rejected or migrated by an explicit, tested migration; it is never silently reinterpreted. | [[spec]] |
| contract_rejection_explained | invariant | A rejected contract returns a stable machine-readable reason code and a non-sensitive diagnostic. | [[spec]] |
| corrected_contract_received | invariant | An invalid contract returns to proposed only after a new or corrected contract payload is supplied. | [[spec]] |
| retirement_requested | invariant | A validated contract is retired only by explicit retirement, supersession, or expiry. | [[spec]] |

| contract_declares_contribution | invariant | Every interaction contract identifies the contribution primitive or versioned pattern it requests; semantic purpose is not inferred from a widget kind. | [[spec]] |
| accessibility_obligations_carried | invariant | Every contract carries or references semantic accessibility obligations required of every host realization, including naming, operation, focus/navigation, status/error communication, and timing where applicable. | [[spec]] |
| escape_paths_declared | invariant | Every contract declares supported reject, defer, cancel, dismiss, and timeout semantics instead of treating absence as an answer. | [[spec]] |

## Model
### States
- `proposed`
- `validated`
- `invalid`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_contract | proposed | validated | [[spec.contract_payload_valid]] |
| reject_contract | proposed | invalid | ¬([[spec.contract_payload_valid]]) |
| revise_invalid_contract | invalid | proposed | [[spec.corrected_contract_received]] |
| retire_contract | validated | retired | [[spec.retirement_requested]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| malformed_contract_is_rejected | unit | [[spec.contract_payload_valid]] | `any::<String>()` | `TypeScript test: malformed kind-specific payload never validates` |
| unknown_kind_never_renders | unit | [[spec.contract_kind_allowlisted]] | `any::<String>()` | `TypeScript test: unknown kinds are rejected without component lookup or dynamic import` |
| limits_are_enforced_at_boundary | unit | [[spec.contract_has_bounded_content]] | `any::<String>()` | `TypeScript test: each field rejects values just above its declared limit and accepts allowed boundary values` |
| executable_content_is_rejected | unit | [[spec.contract_is_data_only]] | `any::<String>()` | `TypeScript test: script/handler/HTML payloads are rejected or rendered as inert escaped text; never executed` |
| response_identity_is_preserved | unit | [[spec.response_correlated]] | `any::<String>()` | `TypeScript test: accepted response preserves all IDs and preconditions from the originating contract` |
| incompatible_version_never_silently_loads | unit | [[spec.contract_version_migration_explicit]] | `any::<String>()` | `TypeScript test: unsupported schema version returns a typed error unless a registered migration succeeds` |
| rejection_has_stable_reason | unit | [[spec.contract_rejection_explained]] | `any::<String>()` | `TypeScript test: same invalid condition yields the same documented reason code without leaking secret data` |
| contract_identity_is_complete | unit | [[spec.contract_has_identity_and_version]] | `any::<String>()` | `TypeScript test: any missing required identity/version field makes validation fail` |
| invalid_contract_requires_correction | unit | [[spec.corrected_contract_received]] | `any::<String>()` | `TypeScript test: invalid contract is not resubmitted until a new or corrected payload arrives` |
| retirement_requires_command | unit | [[spec.retirement_requested]] | `any::<String>()` | `TypeScript test: validated contract remains active until explicit retirement, supersession, or expiry` |
| contract_has_semantic_contribution | unit | [[spec.contract_declares_contribution]] | `any::<String>()` | `Cross-host test: same contract preserves contribution primitive/pattern identity` |
| contract_has_accessibility_obligations | unit | [[spec.accessibility_obligations_carried]] | `any::<String>()` | `Schema test: renderable contracts expose required accessibility obligations` |
| p_escape_paths_declared | unit | [[spec.escape_paths_declared]] | `arbitrary_state()` | `every contract declares supported reject, defer, cancel, dismiss, and timeout semantics instead of treating absence as an answer` |

## Requirements

### Requirement: Interaction Contract Layer declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction Contract Layer invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.malformed_contract_is_rejected]]
- **VERIFIES** [[spec.unknown_kind_never_renders]]
- **VERIFIES** [[spec.limits_are_enforced_at_boundary]]
- **VERIFIES** [[spec.executable_content_is_rejected]]
- **VERIFIES** [[spec.response_identity_is_preserved]]
- **VERIFIES** [[spec.incompatible_version_never_silently_loads]]
- **VERIFIES** [[spec.rejection_has_stable_reason]]
- **VERIFIES** [[spec.contract_identity_is_complete]]
- **VERIFIES** [[spec.invalid_contract_requires_correction]]
- **VERIFIES** [[spec.retirement_requires_command]]
- **VERIFIES** [[spec.contract_has_semantic_contribution]]
- **VERIFIES** [[spec.contract_has_accessibility_obligations]]
- **VERIFIES** [[spec.p_escape_paths_declared]]

#### Scenario: Violating a Interaction Contract Layer invariant is rejected

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
