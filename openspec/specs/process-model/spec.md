---
id: spec
kind: intent
statement: THE Process Model Layer SHALL represent task progression and dependencies independently from interface presentation
---

# Process Model Primitives

Process models represent lifecycle and control flow, not screen layout. The initial system supports finite-state workflows and dependency DAGs; reactive derived state, constraint models, and temporal/event histories may be layered on without forcing every task into one universal representation. A process model declares its completion conditions, waits, cancellation behavior, and recovery path.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| process_kind_explicit | invariant | Every process definition declares its model kind and schema version. | [[spec]] |
| transitions_guarded | invariant | Every state transition declares a guard and a defined outcome when the guard is false or evaluation is unavailable. | [[spec]] |
| dependencies_acyclic_or_declared | invariant | A dependency graph is acyclic unless an explicit bounded loop construct defines termination and iteration limits. | [[spec]] |
| completion_criteria_explicit | invariant | A process cannot be marked complete until its declared completion conditions have been evaluated successfully. | [[spec]] |
| waits_correlated | invariant | Suspended work records the event or condition that can resume it; unrelated events cannot resume the wait. | [[spec]] |
| cancellation_semantics_defined | invariant | Every cancellable process declares which local state is discarded and which already-performed external effects require compensation. | [[spec]] |
| process_state_not_ui_state | invariant | Changing presentation state alone cannot advance or complete the underlying process. | [[spec]] |

| failure_recovery_edges_explicit | invariant | Processes that can perform effects declare failure containment and applicable recovery/reconciliation edges; a generic failed terminal state is insufficient for unknown or partial effects. | [[spec]] |
| process_failure_recorded | effect | `process.model.process_failure(detail) — a process terminates in failure because detail; failure provenance is retained and applicable recovery/reconciliation edges are surfaced per failure_recovery_edges_explicit` | [[spec]] |
| compound_human_activity_uses_patterns | invariant | Planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states. | [[spec]] |

## Model
### States
- `draft`
- `validated`
- `running`
- `waiting`
- `completed`
- `failed` (emits: `[[spec.process_failure_recorded]]`)
- `cancelled`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_process | draft | validated | [[spec.completion_criteria_explicit]] |
| start_process | validated | running | [[spec.transitions_guarded]] |
| suspend_process | running | waiting | [[spec.waits_correlated]] |
| resume_correlated_wait | waiting | running | [[spec.waits_correlated]] |
| complete_process | running | completed | [[spec.completion_criteria_explicit]] |
| fail_process | running | failed | ¬([[spec.completion_criteria_explicit]] ∨ [[spec.waits_correlated]] ∨ [[spec.cancellation_semantics_defined]]) |
| cancel_process | running | cancelled | [[spec.cancellation_semantics_defined]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| process_kind_explicit_holds | unit | [[spec.process_kind_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant process_kind_explicit at its trust boundary and under its stated edge cases.` |
| transitions_guarded_holds | unit | [[spec.transitions_guarded]] | `any::<String>()` | `TypeScript conformance test: assert invariant transitions_guarded at its trust boundary and under its stated edge cases.` |
| dependencies_acyclic_or_declared_holds | unit | [[spec.dependencies_acyclic_or_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant dependencies_acyclic_or_declared at its trust boundary and under its stated edge cases.` |
| completion_criteria_explicit_holds | unit | [[spec.completion_criteria_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant completion_criteria_explicit at its trust boundary and under its stated edge cases.` |
| waits_correlated_holds | unit | [[spec.waits_correlated]] | `any::<String>()` | `TypeScript conformance test: assert invariant waits_correlated at its trust boundary and under its stated edge cases.` |
| cancellation_semantics_defined_holds | unit | [[spec.cancellation_semantics_defined]] | `any::<String>()` | `TypeScript conformance test: assert invariant cancellation_semantics_defined at its trust boundary and under its stated edge cases.` |
| process_state_not_ui_state_holds | unit | [[spec.process_state_not_ui_state]] | `any::<String>()` | `TypeScript conformance test: assert invariant process_state_not_ui_state at its trust boundary and under its stated edge cases.` |
| effectful_process_has_recovery_path | unit | [[spec.failure_recovery_edges_explicit]] | `any::<String>()` | `Graph test: effectful nodes expose typed failure/recovery edges` |
| p_compound_human_activity_uses_patterns | unit | [[spec.compound_human_activity_uses_patterns]] | `arbitrary_state()` | `planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states` |
| p_process_failure_recorded | unit | [[spec.process_failure_recorded]] | `arbitrary_failed_process()` | `failure provenance retained ∧ recovery/reconciliation edges surfaced` |

## Requirements

### Requirement: Process Model Primitives declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Process Model Primitives invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.process_kind_explicit_holds]]
- **VERIFIES** [[spec.transitions_guarded_holds]]
- **VERIFIES** [[spec.dependencies_acyclic_or_declared_holds]]
- **VERIFIES** [[spec.completion_criteria_explicit_holds]]
- **VERIFIES** [[spec.waits_correlated_holds]]
- **VERIFIES** [[spec.cancellation_semantics_defined_holds]]
- **VERIFIES** [[spec.process_state_not_ui_state_holds]]
- **VERIFIES** [[spec.effectful_process_has_recovery_path]]
- **VERIFIES** [[spec.p_compound_human_activity_uses_patterns]]
- **VERIFIES** [[spec.p_process_failure_recorded]]

#### Scenario: Violating a Process Model Primitives invariant is rejected

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
