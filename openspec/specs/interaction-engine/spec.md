---
id: spec
kind: intent
statement: THE Interaction Engine SHALL evaluate normalized interaction needs through a host-neutral deterministic core
---

# Interaction Engine

The engine orchestrates the decision boundary between an agent's proposed human-contribution need and the trusted interaction policy/catalog. It returns decision data only; it does not render UI, execute external actions, or grant authority.

## Constraints

| id | kind | expr | traces_to |
|---|---|---|---|
| context_schema_valid | invariant | Every context entering policy evaluation validates against the declared context schema and contains task identity, task revision, normalized need, available catalog version, and policy version. | [[spec]] |
| policy_catalog_versions_pinned | invariant | One evaluation uses exactly one immutable policy version and one immutable interaction-catalog version, and includes both versions in its result. | [[spec]] |
| deterministic_decision | invariant | Equal canonical contexts evaluated with equal policy/catalog versions produce structurally equal decision results, including proposal ordering and reason codes. | [[spec]] |
| context_version_current | invariant | A decision may be committed only if the task revision used to compute it is still current at the commit boundary. | [[spec]] |
| no_effects_in_core | invariant | Evaluation and reduction expose requested external work as data and perform no filesystem, network, UI, model, or domain side effects. | [[spec]] |
| host_neutral_types | invariant | Public core types contain no Pi, DOM, browser, React, TUI-library, or MCP-SDK types. | [[spec]] |
| rejected_context_not_committed | invariant | A malformed or stale context never produces a committed active interaction and leaves the prior committed task state unchanged. | [[spec]] |
| corrected_context_received | invariant | Leaving an invalid or stale context state for a new draft requires an explicitly newly received context snapshot. | [[spec]] |
| retirement_requested | invariant | A committed decision is retired only in response to an explicit retire, cancel, supersede, or expiry command. | [[spec]] |
| retain_decision_provenance | invariant | Every decision result records normalized need, task revision, policy/catalog versions, ordered candidates, exclusions, and stable reason codes. | [[spec]] |

## Model

### States
- `draft`
- `normalized`
- `evaluated`
- `committed`
- `invalid_context`
- `stale_context`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| accept_context | draft | normalized | [[spec.context_schema_valid]] |
| reject_invalid_context | draft | invalid_context | ¬([[spec.context_schema_valid]]) |
| correct_invalid_context | invalid_context | draft | [[spec.corrected_context_received]] |
| evaluate_pinned_context | normalized | evaluated | [[spec.policy_catalog_versions_pinned]] |
| commit_current_decision | evaluated | committed | [[spec.context_version_current]] |
| reject_stale_decision | evaluated | stale_context | ¬([[spec.context_version_current]]) |
| refresh_stale_context | stale_context | draft | [[spec.corrected_context_received]] |
| retire_committed_decision | committed | retired | [[spec.retirement_requested]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| context_validation_rejects_malformed | unit | [[spec.context_schema_valid]] | `any::<String>()` | `TypeScript test: malformed context is rejected before policy evaluation` |
| evaluation_versions_are_pinned | unit | [[spec.policy_catalog_versions_pinned]] | `any::<String>()` | `TypeScript test: result carries the exact policy and catalog versions used` |
| identical_inputs_are_deterministic | unit | [[spec.deterministic_decision]] | `any::<String>()` | `TypeScript test: repeated evaluation returns deeply equal ordered results` |
| stale_result_is_not_committed | unit | [[spec.context_version_current]] | `any::<String>()` | `TypeScript test: task revision change between evaluation and commit prevents commit and preserves prior committed state` |
| core_has_no_host_or_io_imports | unit | [[spec.host_neutral_types]] | `any::<String>()` | `Static TypeScript test: forbidden host imports and ambient host types are absent from core` |
| rejection_preserves_state | unit | [[spec.rejected_context_not_committed]] | `any::<String>()` | `TypeScript test: invalid and stale contexts do not mutate committed task state` |
| corrected_context_reenters_draft | unit | [[spec.corrected_context_received]] | `any::<String>()` | `TypeScript test: rejected context can re-enter draft only after an explicit new snapshot arrives` |
| retirement_is_explicit | unit | [[spec.retirement_requested]] | `any::<String>()` | `TypeScript test: committed decision retires only after explicit retire/cancel/supersede/expiry command` |
| decision_has_provenance | unit | [[spec.retain_decision_provenance]] | `any::<String>()` | `TypeScript test: every result includes input revision, policy/catalog versions, candidates, exclusions and reason codes` |
| core_evaluation_has_no_effects | unit | [[spec.no_effects_in_core]] | `any::<String>()` | `Static TypeScript test: core calls no I/O, rendering, model inference or domain-action ports` |

## Requirements

### Requirement: Interaction Engine declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction Engine invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.context_validation_rejects_malformed]]
- **VERIFIES** [[spec.evaluation_versions_are_pinned]]
- **VERIFIES** [[spec.identical_inputs_are_deterministic]]
- **VERIFIES** [[spec.stale_result_is_not_committed]]
- **VERIFIES** [[spec.core_has_no_host_or_io_imports]]
- **VERIFIES** [[spec.rejection_preserves_state]]
- **VERIFIES** [[spec.corrected_context_reenters_draft]]
- **VERIFIES** [[spec.retirement_is_explicit]]
- **VERIFIES** [[spec.decision_has_provenance]]
- **VERIFIES** [[spec.core_evaluation_has_no_effects]]

#### Scenario: Violating a Interaction Engine invariant is rejected

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
