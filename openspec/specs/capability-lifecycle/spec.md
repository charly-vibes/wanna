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

### Requirement: Capability Growth Lifecycle model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: inspect-candidate moves `proposed` to `inspected`
- **WHEN** the model is in the `proposed` state and the `inspect_candidate` transition guard holds ([[spec.proposal_is_inspectable]])
- **THEN** the model enters the `inspected` state and records the transition
- **VERIFIES** [[spec.proposal_is_inspectable_holds]]

#### Scenario: preview-candidate moves `inspected` to `previewed`
- **WHEN** the model is in the `inspected` state and the `preview_candidate` transition guard holds ([[spec.preview_is_non_committing]])
- **THEN** the model enters the `previewed` state and records the transition
- **VERIFIES** [[spec.preview_is_non_committing_holds]]

#### Scenario: evaluate-candidate moves `previewed` to `evaluated`
- **WHEN** the model is in the `previewed` state and the `evaluate_candidate` transition guard holds ([[spec.goal_and_safety_checks_separate]])
- **THEN** the model enters the `evaluated` state and records the transition
- **VERIFIES** [[spec.goal_and_safety_checks_separate_holds]]

#### Scenario: approve-candidate moves `evaluated` to `approved`
- **WHEN** the model is in the `evaluated` state and the `approve_candidate` transition guard holds ([[spec.acceptance_requires_gate]])
- **THEN** the model enters the `approved` state and records the transition
- **VERIFIES** [[spec.acceptance_requires_gate_holds]]

#### Scenario: register-candidate moves `approved` to `registered`
- **WHEN** the model is in the `approved` state and the `register_candidate` transition guard holds ([[spec.failed_candidate_not_active]])
- **THEN** the model enters the `registered` state and records the transition
- **VERIFIES** [[spec.failed_candidate_not_active_holds]]

#### Scenario: reject-candidate moves `evaluated` to `rejected`
- **WHEN** the model is in the `evaluated` state and the `reject_candidate` transition guard evaluates false (¬([[spec.failed_candidate_not_active]]))
- **THEN** the model enters the `rejected` state and records the transition
- **VERIFIES** [[spec.failed_candidate_not_active_holds]]

#### Scenario: retire-capability moves `registered` to `retired`
- **WHEN** the model is in the `registered` state and the `retire_capability` transition guard holds ([[spec.retirement_and_recovery_supported]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[spec.retirement_and_recovery_supported_holds]]

#### Scenario: existing-use-distinct-from-development invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Invoking an existing registered capability is a different operation from proposing or changing its implementation and uses a distinct policy path."
- **VERIFIES** [[spec.existing_use_distinct_from_development_holds]]

#### Scenario: composition-is-bounded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Declarative capability composition validates dependency availability, type compatibility, cycle constraints, and execution budgets before registration."
- **VERIFIES** [[spec.composition_is_bounded_holds]]

#### Scenario: Violating Capability Growth Lifecycle invariant is rejected

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
