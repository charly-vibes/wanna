---
id: capability.lifecycle
kind: intent
statement: THE Capability Lifecycle SHALL distinguish proposing, inspecting, previewing, evaluating, accepting, using, and retiring reusable capabilities
---

# Capability Growth Lifecycle

This lifecycle captures the Jiti-style idea of an application that grows through conversation while retaining explicit governance. The first implementation should prefer declarative compositions of trusted operations. Live executable extensions, if introduced later, require a separate execution boundary and stronger isolation guarantees.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| proposal_is_inspectable | invariant | A capability proposal exposes its intended behavior, dependencies, effect declarations, tests, and source provenance before approval. | [[capability.lifecycle]] |
| preview_is_non_committing | invariant | Preview evaluates a candidate in an isolated or reversible context and does not make it the active capability revision. | [[capability.lifecycle]] |
| goal_and_safety_checks_separate | invariant | Goal checks measure whether the requested capability was achieved; safety invariants determine whether the candidate state is acceptable. | [[capability.lifecycle]] |
| acceptance_requires_gate | invariant | A candidate becomes registered only after all required validation gates and approvals for its risk class succeed. | [[capability.lifecycle]] |
| existing_use_distinct_from_development | invariant | Invoking an existing registered capability is a different operation from proposing or changing its implementation and uses a distinct policy path. | [[capability.lifecycle]] |
| failed_candidate_not_active | invariant | A candidate that fails a safety invariant or required conformance check cannot replace the active revision. | [[capability.lifecycle]] |
| retirement_and_recovery_supported | invariant | A registered capability can be deprecated or retired, and a prior accepted revision can be restored without erasing audit history. | [[capability.lifecycle]] |
| composition_is_bounded | invariant | Declarative capability composition validates dependency availability, type compatibility, cycle constraints, and execution budgets before registration. | [[capability.lifecycle]] |

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
| inspect_candidate | proposed | inspected | [[capability.lifecycle.proposal_is_inspectable]] |
| preview_candidate | inspected | previewed | [[capability.lifecycle.preview_is_non_committing]] |
| evaluate_candidate | previewed | evaluated | [[capability.lifecycle.goal_and_safety_checks_separate]] |
| approve_candidate | evaluated | approved | [[capability.lifecycle.acceptance_requires_gate]] |
| register_candidate | approved | registered | [[capability.lifecycle.failed_candidate_not_active]] |
| reject_candidate | evaluated | rejected | ¬([[capability.lifecycle.failed_candidate_not_active]]) |
| retire_capability | registered | retired | [[capability.lifecycle.retirement_and_recovery_supported]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| proposal_is_inspectable_holds | unit | [[capability.lifecycle.proposal_is_inspectable]] | `any::<String>()` | `TypeScript conformance test: assert invariant proposal_is_inspectable at its trust boundary and under its stated edge cases.` |
| preview_is_non_committing_holds | unit | [[capability.lifecycle.preview_is_non_committing]] | `any::<String>()` | `TypeScript conformance test: assert invariant preview_is_non_committing at its trust boundary and under its stated edge cases.` |
| goal_and_safety_checks_separate_holds | unit | [[capability.lifecycle.goal_and_safety_checks_separate]] | `any::<String>()` | `TypeScript conformance test: assert invariant goal_and_safety_checks_separate at its trust boundary and under its stated edge cases.` |
| acceptance_requires_gate_holds | unit | [[capability.lifecycle.acceptance_requires_gate]] | `any::<String>()` | `TypeScript conformance test: assert invariant acceptance_requires_gate at its trust boundary and under its stated edge cases.` |
| existing_use_distinct_from_development_holds | unit | [[capability.lifecycle.existing_use_distinct_from_development]] | `any::<String>()` | `TypeScript conformance test: assert invariant existing_use_distinct_from_development at its trust boundary and under its stated edge cases.` |
| failed_candidate_not_active_holds | unit | [[capability.lifecycle.failed_candidate_not_active]] | `any::<String>()` | `TypeScript conformance test: assert invariant failed_candidate_not_active at its trust boundary and under its stated edge cases.` |
| retirement_and_recovery_supported_holds | unit | [[capability.lifecycle.retirement_and_recovery_supported]] | `any::<String>()` | `TypeScript conformance test: assert invariant retirement_and_recovery_supported at its trust boundary and under its stated edge cases.` |
| composition_is_bounded_holds | unit | [[capability.lifecycle.composition_is_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant composition_is_bounded at its trust boundary and under its stated edge cases.` |
