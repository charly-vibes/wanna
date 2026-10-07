---
id: spec
kind: intent
statement: THE Capability Lifecycle SHALL distinguish proposing, inspecting, previewing, evaluating, accepting, using, and retiring reusable capabilities
---

# Capability Growth Lifecycle

This lifecycle captures the Jiti-style idea of an application that grows through conversation while retaining explicit governance. The first implementation should prefer declarative compositions of trusted operations. Live executable extensions, if introduced later, require a separate execution boundary and stronger isolation guarantees.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| proposal_is_inspectable | invariant | A capability proposal exposes its intended behavior, dependencies, effect declarations, tests, and source provenance before approval. | [[spec]] |
| preview_is_non_committing | invariant | Preview evaluates a candidate in an isolated or reversible context and does not make it the active capability revision. | [[spec]] |
| goal_and_safety_checks_separate | invariant | Goal checks measure whether the requested capability was achieved; safety invariants determine whether the candidate state is acceptable. | [[spec]] |
| acceptance_requires_gate | invariant | A candidate becomes registered only after all required validation gates and approvals for its risk class succeed. | [[spec]] |
| existing_use_distinct_from_development | invariant | Invoking an existing registered capability is a different operation from proposing or changing its implementation and uses a distinct policy path. | [[spec]] |
| failed_candidate_not_active | invariant | A candidate that fails a safety invariant or required conformance check cannot replace the active revision. | [[spec]] |
| retirement_and_recovery_supported | invariant | A registered capability can be deprecated or retired, and a prior accepted revision can be restored without erasing audit history. | [[spec]] |
| composition_is_bounded | invariant | Declarative capability composition validates dependency availability, type compatibility, cycle constraints, and execution budgets before registration. | [[spec]] |

## Model
### States
- `proposed`
- `inspected`
- `previewed`
- `evaluated`
- `approved`
- `registered`
- `rejected`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| inspect_candidate | proposed | inspected | [[spec.proposal_is_inspectable]] |
| preview_candidate | inspected | previewed | [[spec.preview_is_non_committing]] |
| evaluate_candidate | previewed | evaluated | [[spec.goal_and_safety_checks_separate]] |
| approve_candidate | evaluated | approved | [[spec.acceptance_requires_gate]] |
| register_candidate | approved | registered | [[spec.failed_candidate_not_active]] |
| reject_candidate | evaluated | rejected | ¬([[spec.failed_candidate_not_active]]) |
| retire_capability | registered | retired | [[spec.retirement_and_recovery_supported]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| proposal_is_inspectable_holds | unit | [[spec.proposal_is_inspectable]] | `any::<String>()` | `TypeScript conformance test: assert invariant proposal_is_inspectable at its trust boundary and under its stated edge cases.` |
| preview_is_non_committing_holds | unit | [[spec.preview_is_non_committing]] | `any::<String>()` | `TypeScript conformance test: assert invariant preview_is_non_committing at its trust boundary and under its stated edge cases.` |
| goal_and_safety_checks_separate_holds | unit | [[spec.goal_and_safety_checks_separate]] | `any::<String>()` | `TypeScript conformance test: assert invariant goal_and_safety_checks_separate at its trust boundary and under its stated edge cases.` |
| acceptance_requires_gate_holds | unit | [[spec.acceptance_requires_gate]] | `any::<String>()` | `TypeScript conformance test: assert invariant acceptance_requires_gate at its trust boundary and under its stated edge cases.` |
| existing_use_distinct_from_development_holds | unit | [[spec.existing_use_distinct_from_development]] | `any::<String>()` | `TypeScript conformance test: assert invariant existing_use_distinct_from_development at its trust boundary and under its stated edge cases.` |
| failed_candidate_not_active_holds | unit | [[spec.failed_candidate_not_active]] | `any::<String>()` | `TypeScript conformance test: assert invariant failed_candidate_not_active at its trust boundary and under its stated edge cases.` |
| retirement_and_recovery_supported_holds | unit | [[spec.retirement_and_recovery_supported]] | `any::<String>()` | `TypeScript conformance test: assert invariant retirement_and_recovery_supported at its trust boundary and under its stated edge cases.` |
| composition_is_bounded_holds | unit | [[spec.composition_is_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant composition_is_bounded at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Capability Growth Lifecycle declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Capability Growth Lifecycle invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.proposal_is_inspectable_holds]]
- **VERIFIES** [[spec.preview_is_non_committing_holds]]
- **VERIFIES** [[spec.goal_and_safety_checks_separate_holds]]
- **VERIFIES** [[spec.acceptance_requires_gate_holds]]
- **VERIFIES** [[spec.existing_use_distinct_from_development_holds]]
- **VERIFIES** [[spec.failed_candidate_not_active_holds]]
- **VERIFIES** [[spec.retirement_and_recovery_supported_holds]]
- **VERIFIES** [[spec.composition_is_bounded_holds]]

#### Scenario: Violating a Capability Growth Lifecycle invariant is rejected

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
