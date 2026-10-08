---
id: process.model
kind: intent
statement: THE Process Model Layer SHALL represent task progression and dependencies independently from interface presentation
---

# Process Model Primitives

Process models represent lifecycle and control flow, not screen layout. The initial system supports finite-state workflows and dependency DAGs; reactive derived state, constraint models, and temporal/event histories may be layered on without forcing every task into one universal representation. A process model declares its completion conditions, waits, cancellation behavior, and recovery path.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| process_kind_explicit | invariant | Every process definition declares its model kind and schema version. | [[process.model]] |
| transitions_guarded | invariant | Every state transition declares a guard and a defined outcome when the guard is false or evaluation is unavailable. | [[process.model]] |
| dependencies_acyclic_or_declared | invariant | A dependency graph is acyclic unless an explicit bounded loop construct defines termination and iteration limits. | [[process.model]] |
| completion_criteria_explicit | invariant | A process cannot be marked complete until its declared completion conditions have been evaluated successfully. | [[process.model]] |
| waits_correlated | invariant | Suspended work records the event or condition that can resume it; unrelated events cannot resume the wait. | [[process.model]] |
| cancellation_semantics_defined | invariant | Every cancellable process declares which local state is discarded and which already-performed external effects require compensation. | [[process.model]] |
| process_state_not_ui_state | invariant | Changing presentation state alone cannot advance or complete the underlying process. | [[process.model]] |

| failure_recovery_edges_explicit | invariant | Processes that can perform effects declare failure containment and applicable recovery/reconciliation edges; a generic failed terminal state is insufficient for unknown or partial effects. | [[process.model]] |
| process_failure_recorded | effect | `process.model.process_failure(detail) — a process terminates in failure because detail; failure provenance is retained and applicable recovery/reconciliation edges are surfaced per failure_recovery_edges_explicit` | [[process.model]] |
| compound_human_activity_uses_patterns | invariant | Planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states. | [[process.model]] |

## Model
### States
- `draft`
- `validated`
- `running`
- `waiting`
- `completed`
- `failed` (emits: `[[process.model.process_failure_recorded]]`)
- `cancelled`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_process | draft | validated | [[process.model.completion_criteria_explicit]] |
| start_process | validated | running | [[process.model.transitions_guarded]] |
| suspend_process | running | waiting | [[process.model.waits_correlated]] |
| resume_correlated_wait | waiting | running | [[process.model.waits_correlated]] |
| complete_process | running | completed | [[process.model.completion_criteria_explicit]] |
| fail_process | running | failed | ¬([[process.model.completion_criteria_explicit]] ∨ [[process.model.waits_correlated]] ∨ [[process.model.cancellation_semantics_defined]]) |
| cancel_process | running | cancelled | [[process.model.cancellation_semantics_defined]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| process_kind_explicit_holds | unit | [[process.model.process_kind_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant process_kind_explicit at its trust boundary and under its stated edge cases.` |
| transitions_guarded_holds | unit | [[process.model.transitions_guarded]] | `any::<String>()` | `TypeScript conformance test: assert invariant transitions_guarded at its trust boundary and under its stated edge cases.` |
| dependencies_acyclic_or_declared_holds | unit | [[process.model.dependencies_acyclic_or_declared]] | `fc.array(fc.tuple(fc.nat({max:7}), fc.nat({max:7}))) forward-edge sets over an 8-node chain (DAG by construction) with an injected n7->n0 back edge x fc.option(fc.record({terminationCondition: fc.string(), maxIterations: fc.integer({min:-2,max:50})})) bounded loops` | `TypeScript conformance test: assert invariant dependencies_acyclic_or_declared at its trust boundary and under its stated edge cases.` |
| completion_criteria_explicit_holds | unit | [[process.model.completion_criteria_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant completion_criteria_explicit at its trust boundary and under its stated edge cases.` |
| waits_correlated_holds | unit | [[process.model.waits_correlated]] | `fc.array(fc.stringMatching(/^[a-z-]{1,8}$/), {maxLength:5}) resume-event lists` | `TypeScript conformance test: assert invariant waits_correlated at its trust boundary and under its stated edge cases.` |
| cancellation_semantics_defined_holds | unit | [[process.model.cancellation_semantics_defined]] | `any::<String>()` | `TypeScript conformance test: assert invariant cancellation_semantics_defined at its trust boundary and under its stated edge cases.` |
| process_state_not_ui_state_holds | unit | [[process.model.process_state_not_ui_state]] | `any::<String>()` | `TypeScript conformance test: assert invariant process_state_not_ui_state at its trust boundary and under its stated edge cases.` |
| effectful_process_has_recovery_path | unit | [[process.model.failure_recovery_edges_explicit]] | `any::<String>()` | `Graph test: effectful nodes expose typed failure/recovery edges` |
| p_compound_human_activity_uses_patterns | unit | [[process.model.compound_human_activity_uses_patterns]] | `arbitrary_state()` | `planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states` |
| p_process_failure_recorded | unit | [[process.model.process_failure_recorded]] | `arbitrary_failed_process()` | `failure provenance retained ∧ recovery/reconciliation edges surfaced` |

## Requirements

### Requirement: Process Model Primitives model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-process moves `draft` to `validated`
- **WHEN** the model is in the `draft` state and the `validate_process` transition guard holds ([[process.model.completion_criteria_explicit]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[process.model.completion_criteria_explicit_holds]]

#### Scenario: start-process moves `validated` to `running`
- **WHEN** the model is in the `validated` state and the `start_process` transition guard holds ([[process.model.transitions_guarded]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[process.model.transitions_guarded_holds]]

#### Scenario: suspend-process moves `running` to `waiting`
- **WHEN** the model is in the `running` state and the `suspend_process` transition guard holds ([[process.model.waits_correlated]])
- **THEN** the model enters the `waiting` state and records the transition
- **VERIFIES** [[process.model.waits_correlated_holds]]

#### Scenario: resume-correlated-wait moves `waiting` to `running`
- **WHEN** the model is in the `waiting` state and the `resume_correlated_wait` transition guard holds ([[process.model.waits_correlated]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[process.model.waits_correlated_holds]]

#### Scenario: complete-process moves `running` to `completed`
- **WHEN** the model is in the `running` state and the `complete_process` transition guard holds ([[process.model.completion_criteria_explicit]])
- **THEN** the model enters the `completed` state and records the transition
- **VERIFIES** [[process.model.completion_criteria_explicit_holds]]

#### Scenario: fail-process moves `running` to `failed`
- **WHEN** the model is in the `running` state and the `fail_process` transition guard evaluates false (¬([[process.model.completion_criteria_explicit]] ∨ [[process.model.waits_correlated]] ∨ [[process.model.cancellation_semantics_defined]]))
- **THEN** the model enters the `failed` state and records the transition
- **VERIFIES** [[process.model.cancellation_semantics_defined_holds]]
- **VERIFIES** [[process.model.completion_criteria_explicit_holds]]
- **VERIFIES** [[process.model.waits_correlated_holds]]

#### Scenario: cancel-process moves `running` to `cancelled`
- **WHEN** the model is in the `running` state and the `cancel_process` transition guard holds ([[process.model.cancellation_semantics_defined]])
- **THEN** the model enters the `cancelled` state and records the transition
- **VERIFIES** [[process.model.cancellation_semantics_defined_holds]]

#### Scenario: process-kind-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every process definition declares its model kind and schema version."
- **VERIFIES** [[process.model.process_kind_explicit_holds]]

#### Scenario: dependencies-acyclic-or-declared invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A dependency graph is acyclic unless an explicit bounded loop construct defines termination and iteration limits."
- **VERIFIES** [[process.model.dependencies_acyclic_or_declared_holds]]

#### Scenario: process-state-not-ui-state invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Changing presentation state alone cannot advance or complete the underlying process."
- **VERIFIES** [[process.model.process_state_not_ui_state_holds]]

#### Scenario: failure-recovery-edges-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Processes that can perform effects declare failure containment and applicable recovery/reconciliation edges; a generic failed terminal state is insufficient for unknown or partial effects."
- **VERIFIES** [[process.model.effectful_process_has_recovery_path]]

#### Scenario: process-failure-recorded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "`process.model.process_failure(detail) — a process terminates in failure because detail; failure provenance is retained and applicable recovery/reconciliation edges are surfaced per failure_recovery_edges_explicit`"
- **VERIFIES** [[process.model.p_process_failure_recorded]]

#### Scenario: compound-human-activity-uses-patterns invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states."
- **VERIFIES** [[process.model.p_compound_human_activity_uses_patterns]]

#### Scenario: Violating Process Model Primitives invariant is rejected

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
