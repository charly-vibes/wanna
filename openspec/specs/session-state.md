---
id: session.state
kind: intent
statement: THE Session State Layer SHALL maintain resumable interaction lifecycle state without conflating it with domain state or presentation state
---

# Interaction Session State

A session groups related tasks and interactions. It records active revisions, pending questions, suspended waits, cancellation, and recovery metadata. Session state must be serializable and host-neutral; ephemeral cursor position or terminal widget state belongs to the host presentation adapter unless it affects task semantics.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| session_identity_stable | invariant | Every session has a stable ID and monotonically increasing session revision. | [[session.state]] |
| pending_interactions_indexed | invariant | Pending interactions are indexed by stable interaction ID and identify their task and contract revision. | [[session.state]] |
| session_serializable | invariant | Durable session state can be serialized and restored without serializing functions, closures, UI nodes, or host handles. | [[session.state]] |
| resume_validates_revisions | invariant | Restoring a session revalidates schema, task revision, policy version, and interaction contract compatibility before resuming pending work. | [[session.state]] |
| presentation_ephemeral_separate | invariant | Purely visual transient state is not required for domain correctness and is stored separately from durable session state. | [[session.state]] |
| concurrent_updates_detected | invariant | Concurrent state updates are resolved by revision preconditions or explicit conflict handling rather than last-write-wins by default. | [[session.state]] |
| session_close_explicit | invariant | A session becomes closed only through completion, explicit cancellation, or an explicit administrative recovery action. | [[session.state]] |

| resume_reorientation_required | invariant | Restoring serialized session data is not sufficient for resume; continuity state identifies completed, pending, changed, unresolved, and next-attention items. | [[session.state]] |
| presentation_state_non_authoritative | invariant | Host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority. | [[session.state]] |

## Model
### States
- `open`
- `suspended`
- `recovering`
- `closed`
- `conflicted`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| suspend_session | open | suspended | [[session.state.session_serializable]] |
| begin_recovery | suspended | recovering | [[session.state.resume_validates_revisions]] |
| resume_session | recovering | open | [[session.state.resume_validates_revisions]] |
| detect_conflict | open | conflicted | [[session.state.concurrent_updates_detected]] |
| close_session | open | closed | [[session.state.session_close_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| session_identity_stable_holds | unit | [[session.state.session_identity_stable]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_identity_stable at its trust boundary and under its stated edge cases.` |
| pending_interactions_indexed_holds | unit | [[session.state.pending_interactions_indexed]] | `any::<String>()` | `TypeScript conformance test: assert invariant pending_interactions_indexed at its trust boundary and under its stated edge cases.` |
| session_serializable_holds | unit | [[session.state.session_serializable]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_serializable at its trust boundary and under its stated edge cases.` |
| resume_validates_revisions_holds | unit | [[session.state.resume_validates_revisions]] | `any::<String>()` | `TypeScript conformance test: assert invariant resume_validates_revisions at its trust boundary and under its stated edge cases.` |
| presentation_ephemeral_separate_holds | unit | [[session.state.presentation_ephemeral_separate]] | `any::<String>()` | `TypeScript conformance test: assert invariant presentation_ephemeral_separate at its trust boundary and under its stated edge cases.` |
| concurrent_updates_detected_holds | unit | [[session.state.concurrent_updates_detected]] | `any::<String>()` | `TypeScript conformance test: assert invariant concurrent_updates_detected at its trust boundary and under its stated edge cases.` |
| session_close_explicit_holds | unit | [[session.state.session_close_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_close_explicit at its trust boundary and under its stated edge cases.` |
| restored_session_reorients | unit | [[session.state.resume_reorientation_required]] | `any::<String>()` | `Resume test: continuity summary is derivable before consequential continuation` |
| p_presentation_state_non_authoritative | unit | [[session.state.presentation_state_non_authoritative]] | `arbitrary_state()` | `host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority` |
