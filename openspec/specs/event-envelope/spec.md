---
id: event.envelope
kind: intent
statement: THE Event Envelope Layer SHALL correlate, validate, deduplicate, and version-check every interaction event before state reduction
---

# Typed Event Envelope

Events are immutable facts or commands crossing a boundary. A response event carries identity for the session, task, interaction, contract revision, event, and expected task revision. The reducer is pure and returns either a new state plus effect intents or a typed rejection. UI callbacks are adapters that create events; they do not mutate domain state directly.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| event_identity_unique | invariant | Every event has a globally unique or session-scoped unique event ID and a stable event type. | [[event.envelope]] |
| event_origin_correlated | invariant | Every response event identifies its originating session, task, interaction, contract revision, and task revision precondition. | [[event.envelope]] |
| payload_schema_checked | invariant | Event payloads validate against the declared schema before reducer invocation. | [[event.envelope]] |
| duplicate_idempotent | invariant | Reprocessing an event ID already committed produces no second state mutation or duplicate effect intent. | [[event.envelope]] |
| stale_events_rejected | invariant | Events whose expected task or interaction revision is stale are rejected or explicitly reconciled; they are never silently applied to the newer revision. | [[event.envelope]] |
| reducer_pure | invariant | The reducer performs no I/O, rendering, model calls, clock reads, or random generation. | [[event.envelope]] |
| rejection_typed | invariant | Invalid, duplicate, stale, unauthorized, and unsupported events have distinct stable result codes. | [[event.envelope]] |
| event_payload_bounded | invariant | Event payloads enforce byte, nesting, string, collection, and numeric bounds at ingress. | [[event.envelope]] |

## Model
### States
- `received`
- `validated`
- `committed`
- `duplicate`
- `rejected`
- `stale`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_event | received | validated | [[event.envelope.payload_schema_checked]] |
| reject_malformed_event | received | rejected | ¬([[event.envelope.payload_schema_checked]]) |
| commit_event | validated | committed | [[event.envelope.event_origin_correlated]] |
| ignore_duplicate | validated | duplicate | [[event.envelope.duplicate_idempotent]] |
| reject_stale_event | validated | stale | ¬([[event.envelope.stale_events_rejected]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| event_identity_unique_holds | unit | [[event.envelope.event_identity_unique]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_identity_unique at its trust boundary and under its stated edge cases.` |
| event_origin_correlated_holds | unit | [[event.envelope.event_origin_correlated]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_origin_correlated at its trust boundary and under its stated edge cases.` |
| payload_schema_checked_holds | unit | [[event.envelope.payload_schema_checked]] | `any::<String>()` | `TypeScript conformance test: assert invariant payload_schema_checked at its trust boundary and under its stated edge cases.` |
| duplicate_idempotent_holds | unit | [[event.envelope.duplicate_idempotent]] | `fc.record({eventId: fc.string({minLength:1}), eventType: fc.constantFrom("task.submitted","interaction.opened","interaction.resolved","response.delivered","effect.executed"), source/sessionId/taskId/interactionId/contractRevision/expectedTaskRevision: fc.string({minLength:1}), payload: fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), fc.oneof(fc.string({maxLength:64}), fc.integer({max:1e6})))}) x fc.record({committedEventIds: fc.array(fc.string({minLength:1})), currentTaskRevision: fc.string({minLength:1}), authorizedSources: fc.array(fc.string({minLength:1}))})` | `TypeScript conformance test: assert invariant duplicate_idempotent at its trust boundary and under its stated edge cases.` |
| stale_events_rejected_holds | unit | [[event.envelope.stale_events_rejected]] | `arbitrary envelopes x contexts with expectedTaskRevision != currentTaskRevision and envelope.source authorized` | `TypeScript conformance test: assert invariant stale_events_rejected at its trust boundary and under its stated edge cases.` |
| reducer_pure_holds | unit | [[event.envelope.reducer_pure]] | `arbitrary (envelope, context) pairs reduced twice — outcome deeply equal on every generated pair` | `TypeScript conformance test: assert invariant reducer_pure at its trust boundary and under its stated edge cases.` |
| rejection_typed_holds | unit | [[event.envelope.rejection_typed]] | `any::<String>()` | `TypeScript conformance test: assert invariant rejection_typed at its trust boundary and under its stated edge cases.` |
| event_payload_bounded_holds | unit | [[event.envelope.event_payload_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_payload_bounded at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Typed Event Envelope model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-event moves `received` to `validated`
- **WHEN** the model is in the `received` state and the `validate_event` transition guard holds ([[event.envelope.payload_schema_checked]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[event.envelope.payload_schema_checked_holds]]

#### Scenario: reject-malformed-event moves `received` to `rejected`
- **WHEN** the model is in the `received` state and the `reject_malformed_event` transition guard evaluates false (¬([[event.envelope.payload_schema_checked]]))
- **THEN** the model enters the `rejected` state and records the transition
- **VERIFIES** [[event.envelope.payload_schema_checked_holds]]

#### Scenario: commit-event moves `validated` to `committed`
- **WHEN** the model is in the `validated` state and the `commit_event` transition guard holds ([[event.envelope.event_origin_correlated]])
- **THEN** the model enters the `committed` state and records the transition
- **VERIFIES** [[event.envelope.event_origin_correlated_holds]]

#### Scenario: ignore-duplicate moves `validated` to `duplicate`
- **WHEN** the model is in the `validated` state and the `ignore_duplicate` transition guard holds ([[event.envelope.duplicate_idempotent]])
- **THEN** the model enters the `duplicate` state and records the transition
- **VERIFIES** [[event.envelope.duplicate_idempotent_holds]]

#### Scenario: reject-stale-event moves `validated` to `stale`
- **WHEN** the model is in the `validated` state and the `reject_stale_event` transition guard evaluates false (¬([[event.envelope.stale_events_rejected]]))
- **THEN** the model enters the `stale` state and records the transition
- **VERIFIES** [[event.envelope.stale_events_rejected_holds]]

#### Scenario: event-identity-unique invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every event has a globally unique or session-scoped unique event ID and a stable event type."
- **VERIFIES** [[event.envelope.event_identity_unique_holds]]

#### Scenario: reducer-pure invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The reducer performs no I/O, rendering, model calls, clock reads, or random generation."
- **VERIFIES** [[event.envelope.reducer_pure_holds]]

#### Scenario: rejection-typed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Invalid, duplicate, stale, unauthorized, and unsupported events have distinct stable result codes."
- **VERIFIES** [[event.envelope.rejection_typed_holds]]

#### Scenario: event-payload-bounded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Event payloads enforce byte, nesting, string, collection, and numeric bounds at ingress."
- **VERIFIES** [[event.envelope.event_payload_bounded_holds]]

#### Scenario: Violating Typed Event Envelope invariant is rejected

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
