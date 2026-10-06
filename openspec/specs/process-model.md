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
| dependencies_acyclic_or_declared_holds | unit | [[process.model.dependencies_acyclic_or_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant dependencies_acyclic_or_declared at its trust boundary and under its stated edge cases.` |
| completion_criteria_explicit_holds | unit | [[process.model.completion_criteria_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant completion_criteria_explicit at its trust boundary and under its stated edge cases.` |
| waits_correlated_holds | unit | [[process.model.waits_correlated]] | `any::<String>()` | `TypeScript conformance test: assert invariant waits_correlated at its trust boundary and under its stated edge cases.` |
| cancellation_semantics_defined_holds | unit | [[process.model.cancellation_semantics_defined]] | `any::<String>()` | `TypeScript conformance test: assert invariant cancellation_semantics_defined at its trust boundary and under its stated edge cases.` |
| process_state_not_ui_state_holds | unit | [[process.model.process_state_not_ui_state]] | `any::<String>()` | `TypeScript conformance test: assert invariant process_state_not_ui_state at its trust boundary and under its stated edge cases.` |
| effectful_process_has_recovery_path | unit | [[process.model.failure_recovery_edges_explicit]] | `any::<String>()` | `Graph test: effectful nodes expose typed failure/recovery edges` |
| p_compound_human_activity_uses_patterns | unit | [[process.model.compound_human_activity_uses_patterns]] | `arbitrary_state()` | `planning, diagnosis, review, coordination, monitoring, and clarification may be represented as interaction patterns composed of contribution primitives rather than assumed atomic states` |
| p_process_failure_recorded | unit | [[process.model.process_failure_recorded]] | `arbitrary_failed_process()` | `failure provenance retained ∧ recovery/reconciliation edges surfaced` |
