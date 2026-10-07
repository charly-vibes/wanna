---
id: spec
kind: intent
statement: THE Interaction Runtime SHALL apply validated events only when their identity and state preconditions remain current
---

# Interaction Runtime

The runtime reduces validated input events against committed state. Host adapters may deliver an event more than once or out of order. The core must make acceptance/rejection explicit and must not silently apply stale or duplicate submissions.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| event_envelope_valid | invariant | Every incoming event has a unique event ID, task ID, interaction ID, event type, contract version, interaction revision, task revision precondition, and validated payload. | [[spec]] |
| event_commit_preconditions_satisfied | invariant | An event is committed only when its task and interaction revisions match the current state and its event ID has not already been applied within the persistence port's declared deduplication scope. | [[spec]] |
| stale_or_duplicate_event_not_applied | invariant | Stale, out-of-order, retired-interaction, contract-incompatible, or duplicate events do not mutate committed state and return a typed rejection reason. | [[spec]] |
| reducer_is_pure | invariant | The reducer is a deterministic pure function of prior state and a validated event; clock reads, random values, network calls, and persistence are outside it. | [[spec]] |
| commit_and_replay_consistent | invariant | Accepted state changes and replay records are committed atomically when supported by the persistence port; otherwise the adapter declares and tests the weaker failure semantics and never claims durable exactly-once processing. | [[spec]] |
| replay_reconstructs_state | invariant | Replaying the accepted ordered event log from the recorded initial state and schema/policy versions reconstructs the same committed state. | [[spec]] |
| cancellation_is_explicit | invariant | Cancellation, dismissal, expiry, supersession, and retirement are distinct typed outcomes where their semantics differ; they are not silently interpreted as an answer. | [[spec]] |
| derived_view_not_authoritative | invariant | Presentation projections are derived from committed state and cannot mutate domain, process, or authority state. | [[spec]] |
| next_event_received | invariant | An applied event returns the runtime to active processing only when the next event or explicit poll request has arrived. | [[spec]] |
| state_refresh_received | invariant | A state-precondition rejection may be retried only after the runtime receives a refreshed committed-state snapshot. | [[spec]] |
| retirement_requested | invariant | An active interaction is retired only after an explicit cancel, dismiss, expire, supersede, or retire event permitted for that interaction kind. | [[spec]] |

| failure_outcome_typed | invariant | Runtime failures produce or reference a typed failure record including effect certainty rather than only a generic exception. | [[spec]] |
| unknown_effect_blocks_unsafe_retry | invariant | A mutating event with unknown external effect cannot be retried unless idempotency is proven or reconciliation resolves the prior outcome. | [[spec]] |
| continuity_checkpoint_on_suspend | invariant | Suspension or recoverable interruption records the continuity checkpoint required to reorient and reconcile on resume. | [[spec]] |

## Model
### States
- `active`
- `validated`
- `applied`
- `malformed_event`
- `rejected_commit`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_envelope | active | validated | [[spec.event_envelope_valid]] |
| reject_malformed_envelope | active | malformed_event | ¬([[spec.event_envelope_valid]]) |
| apply_current_event | validated | applied | [[spec.event_commit_preconditions_satisfied]] |
| reject_stale_or_duplicate | validated | rejected_commit | ¬([[spec.event_commit_preconditions_satisfied]]) |
| continue_after_apply | applied | active | [[spec.next_event_received]] |
| retry_with_corrected_event | malformed_event | active | [[spec.event_envelope_valid]] |
| retry_after_state_refresh | rejected_commit | active | [[spec.state_refresh_received]] |
| retire_interaction | active | retired | [[spec.retirement_requested]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| malformed_event_never_mutates_state | unit | [[spec.event_envelope_valid]] | `any::<String>()` | `TypeScript test: missing, malformed, or mismatched event identity returns a rejection and leaves committed state unchanged` |
| stale_or_duplicate_is_rejected | unit | [[spec.stale_or_duplicate_event_not_applied]] | `any::<String>()` | `TypeScript test: stale revision and repeated event ID do not produce a second committed state change and expose distinct reason codes` |
| reducer_is_repeatable | unit | [[spec.reducer_is_pure]] | `any::<String>()` | `TypeScript test: equal state/event pairs produce deeply equal next-state and transition outputs` |
| replay_matches_live_reduction | unit | [[spec.replay_reconstructs_state]] | `any::<String>()` | `TypeScript test: replayed sequence reconstructs the exact final state and version` |
| persistence_failure_semantics_are_declared | unit | [[spec.commit_and_replay_consistent]] | `any::<String>()` | `TypeScript test: injected failure at every commit boundary obeys the declared atomic or weaker recovery contract without silent double application` |
| cancellation_is_not_an_answer | unit | [[spec.cancellation_is_explicit]] | `any::<String>()` | `TypeScript test: cancel/dismiss/expire/supersede produce their defined event types and do not fabricate response payloads` |
| projection_cannot_mutate_authority | unit | [[spec.derived_view_not_authoritative]] | `any::<String>()` | `TypeScript test: mutations of a copied render projection cannot affect committed or authorized state` |
| event_preconditions_are_compare_and_swap | unit | [[spec.event_commit_preconditions_satisfied]] | `any::<String>()` | `TypeScript test: only one response against a given interaction revision commits; a concurrent response becomes stale` |
| continue_requires_next_event | unit | [[spec.next_event_received]] | `any::<String>()` | `TypeScript test: applied event does not re-enter active processing without next event or explicit poll` |
| retry_requires_state_refresh | unit | [[spec.state_refresh_received]] | `any::<String>()` | `TypeScript test: stale precondition rejection can retry only after refreshed committed state is received` |
| retirement_requires_lifecycle_event | unit | [[spec.retirement_requested]] | `any::<String>()` | `TypeScript test: active interaction retires only on a permitted explicit lifecycle event` |
| runtime_timeout_does_not_assume_failure | unit | [[spec.failure_outcome_typed]] | `any::<String>()` | `Fault-injection test: lost acknowledgement can yield unknown effect` |
| unsafe_runtime_retry_is_blocked | unit | [[spec.unknown_effect_blocks_unsafe_retry]] | `any::<String>()` | `Property test: no unsafe retry path exists from unknown effect` |
| p_continuity_checkpoint_on_suspend | unit | [[spec.continuity_checkpoint_on_suspend]] | `arbitrary_state()` | `suspension or recoverable interruption records the continuity checkpoint required to reorient and reconcile on resume` |

## Requirements

### Requirement: Interaction Runtime model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-envelope moves `active` to `validated`
- **WHEN** the model is in the `active` state and the `validate_envelope` transition guard holds ([[spec.event_envelope_valid]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.malformed_event_never_mutates_state]]

#### Scenario: reject-malformed-envelope moves `active` to `malformed_event`
- **WHEN** the model is in the `active` state and the `reject_malformed_envelope` transition guard evaluates false (¬([[spec.event_envelope_valid]]))
- **THEN** the model enters the `malformed_event` state and records the transition
- **VERIFIES** [[spec.malformed_event_never_mutates_state]]

#### Scenario: apply-current-event moves `validated` to `applied`
- **WHEN** the model is in the `validated` state and the `apply_current_event` transition guard holds ([[spec.event_commit_preconditions_satisfied]])
- **THEN** the model enters the `applied` state and records the transition
- **VERIFIES** [[spec.event_preconditions_are_compare_and_swap]]

#### Scenario: reject-stale-or-duplicate moves `validated` to `rejected_commit`
- **WHEN** the model is in the `validated` state and the `reject_stale_or_duplicate` transition guard evaluates false (¬([[spec.event_commit_preconditions_satisfied]]))
- **THEN** the model enters the `rejected_commit` state and records the transition
- **VERIFIES** [[spec.event_preconditions_are_compare_and_swap]]

#### Scenario: continue-after-apply moves `applied` to `active`
- **WHEN** the model is in the `applied` state and the `continue_after_apply` transition guard holds ([[spec.next_event_received]])
- **THEN** the model enters the `active` state and records the transition
- **VERIFIES** [[spec.continue_requires_next_event]]

#### Scenario: retry-with-corrected-event moves `malformed_event` to `active`
- **WHEN** the model is in the `malformed_event` state and the `retry_with_corrected_event` transition guard holds ([[spec.event_envelope_valid]])
- **THEN** the model enters the `active` state and records the transition
- **VERIFIES** [[spec.malformed_event_never_mutates_state]]

#### Scenario: retry-after-state-refresh moves `rejected_commit` to `active`
- **WHEN** the model is in the `rejected_commit` state and the `retry_after_state_refresh` transition guard holds ([[spec.state_refresh_received]])
- **THEN** the model enters the `active` state and records the transition
- **VERIFIES** [[spec.retry_requires_state_refresh]]

#### Scenario: retire-interaction moves `active` to `retired`
- **WHEN** the model is in the `active` state and the `retire_interaction` transition guard holds ([[spec.retirement_requested]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[spec.retirement_requires_lifecycle_event]]

#### Scenario: stale-or-duplicate-event-not-applied invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Stale, out-of-order, retired-interaction, contract-incompatible, or duplicate events do not mutate committed state and return a typed rejection reason."
- **VERIFIES** [[spec.stale_or_duplicate_is_rejected]]

#### Scenario: reducer-is-pure invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The reducer is a deterministic pure function of prior state and a validated event; clock reads, random values, network calls, and persistence are outside it."
- **VERIFIES** [[spec.reducer_is_repeatable]]

#### Scenario: commit-and-replay-consistent invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Accepted state changes and replay records are committed atomically when supported by the persistence port; otherwise the adapter declares and tests the weaker failure semantics and never claims durable exactly-once processing."
- **VERIFIES** [[spec.persistence_failure_semantics_are_declared]]

#### Scenario: replay-reconstructs-state invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Replaying the accepted ordered event log from the recorded initial state and schema/policy versions reconstructs the same committed state."
- **VERIFIES** [[spec.replay_matches_live_reduction]]

#### Scenario: cancellation-is-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Cancellation, dismissal, expiry, supersession, and retirement are distinct typed outcomes where their semantics differ; they are not silently interpreted as an answer."
- **VERIFIES** [[spec.cancellation_is_not_an_answer]]

#### Scenario: derived-view-not-authoritative invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Presentation projections are derived from committed state and cannot mutate domain, process, or authority state."
- **VERIFIES** [[spec.projection_cannot_mutate_authority]]

#### Scenario: failure-outcome-typed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Runtime failures produce or reference a typed failure record including effect certainty rather than only a generic exception."
- **VERIFIES** [[spec.runtime_timeout_does_not_assume_failure]]

#### Scenario: unknown-effect-blocks-unsafe-retry invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A mutating event with unknown external effect cannot be retried unless idempotency is proven or reconciliation resolves the prior outcome."
- **VERIFIES** [[spec.unsafe_runtime_retry_is_blocked]]

#### Scenario: continuity-checkpoint-on-suspend invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Suspension or recoverable interruption records the continuity checkpoint required to reorient and reconcile on resume."
- **VERIFIES** [[spec.p_continuity_checkpoint_on_suspend]]

#### Scenario: Violating Interaction Runtime invariant is rejected

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
