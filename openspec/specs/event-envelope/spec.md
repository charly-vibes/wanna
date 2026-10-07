---
id: spec
kind: intent
statement: THE Event Envelope Layer SHALL correlate, validate, deduplicate, and version-check every interaction event before state reduction
---

# Typed Event Envelope

Events are immutable facts or commands crossing a boundary. A response event carries identity for the session, task, interaction, contract revision, event, and expected task revision. The reducer is pure and returns either a new state plus effect intents or a typed rejection. UI callbacks are adapters that create events; they do not mutate domain state directly.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| event_identity_unique | invariant | Every event has a globally unique or session-scoped unique event ID and a stable event type. | [[spec]] |
| event_origin_correlated | invariant | Every response event identifies its originating session, task, interaction, contract revision, and task revision precondition. | [[spec]] |
| payload_schema_checked | invariant | Event payloads validate against the declared schema before reducer invocation. | [[spec]] |
| duplicate_idempotent | invariant | Reprocessing an event ID already committed produces no second state mutation or duplicate effect intent. | [[spec]] |
| stale_events_rejected | invariant | Events whose expected task or interaction revision is stale are rejected or explicitly reconciled; they are never silently applied to the newer revision. | [[spec]] |
| reducer_pure | invariant | The reducer performs no I/O, rendering, model calls, clock reads, or random generation. | [[spec]] |
| rejection_typed | invariant | Invalid, duplicate, stale, unauthorized, and unsupported events have distinct stable result codes. | [[spec]] |
| event_payload_bounded | invariant | Event payloads enforce byte, nesting, string, collection, and numeric bounds at ingress. | [[spec]] |

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
| validate_event | received | validated | [[spec.payload_schema_checked]] |
| reject_malformed_event | received | rejected | ¬([[spec.payload_schema_checked]]) |
| commit_event | validated | committed | [[spec.event_origin_correlated]] |
| ignore_duplicate | validated | duplicate | [[spec.duplicate_idempotent]] |
| reject_stale_event | validated | stale | ¬([[spec.stale_events_rejected]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| event_identity_unique_holds | unit | [[spec.event_identity_unique]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_identity_unique at its trust boundary and under its stated edge cases.` |
| event_origin_correlated_holds | unit | [[spec.event_origin_correlated]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_origin_correlated at its trust boundary and under its stated edge cases.` |
| payload_schema_checked_holds | unit | [[spec.payload_schema_checked]] | `any::<String>()` | `TypeScript conformance test: assert invariant payload_schema_checked at its trust boundary and under its stated edge cases.` |
| duplicate_idempotent_holds | unit | [[spec.duplicate_idempotent]] | `any::<String>()` | `TypeScript conformance test: assert invariant duplicate_idempotent at its trust boundary and under its stated edge cases.` |
| stale_events_rejected_holds | unit | [[spec.stale_events_rejected]] | `any::<String>()` | `TypeScript conformance test: assert invariant stale_events_rejected at its trust boundary and under its stated edge cases.` |
| reducer_pure_holds | unit | [[spec.reducer_pure]] | `any::<String>()` | `TypeScript conformance test: assert invariant reducer_pure at its trust boundary and under its stated edge cases.` |
| rejection_typed_holds | unit | [[spec.rejection_typed]] | `any::<String>()` | `TypeScript conformance test: assert invariant rejection_typed at its trust boundary and under its stated edge cases.` |
| event_payload_bounded_holds | unit | [[spec.event_payload_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_payload_bounded at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Typed Event Envelope declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Typed Event Envelope invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.event_identity_unique_holds]]
- **VERIFIES** [[spec.event_origin_correlated_holds]]
- **VERIFIES** [[spec.payload_schema_checked_holds]]
- **VERIFIES** [[spec.duplicate_idempotent_holds]]
- **VERIFIES** [[spec.stale_events_rejected_holds]]
- **VERIFIES** [[spec.reducer_pure_holds]]
- **VERIFIES** [[spec.rejection_typed_holds]]
- **VERIFIES** [[spec.event_payload_bounded_holds]]

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
