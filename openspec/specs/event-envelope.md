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
| duplicate_idempotent_holds | unit | [[event.envelope.duplicate_idempotent]] | `any::<String>()` | `TypeScript conformance test: assert invariant duplicate_idempotent at its trust boundary and under its stated edge cases.` |
| stale_events_rejected_holds | unit | [[event.envelope.stale_events_rejected]] | `any::<String>()` | `TypeScript conformance test: assert invariant stale_events_rejected at its trust boundary and under its stated edge cases.` |
| reducer_pure_holds | unit | [[event.envelope.reducer_pure]] | `any::<String>()` | `TypeScript conformance test: assert invariant reducer_pure at its trust boundary and under its stated edge cases.` |
| rejection_typed_holds | unit | [[event.envelope.rejection_typed]] | `any::<String>()` | `TypeScript conformance test: assert invariant rejection_typed at its trust boundary and under its stated edge cases.` |
| event_payload_bounded_holds | unit | [[event.envelope.event_payload_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant event_payload_bounded at its trust boundary and under its stated edge cases.` |
