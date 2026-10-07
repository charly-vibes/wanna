---
id: spec
kind: intent
statement: THE Session State Layer SHALL maintain resumable interaction lifecycle state without conflating it with domain state or presentation state
---

# Interaction Session State

A session groups related tasks and interactions. It records active revisions, pending questions, suspended waits, cancellation, and recovery metadata. Session state must be serializable and host-neutral; ephemeral cursor position or terminal widget state belongs to the host presentation adapter unless it affects task semantics.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| session_identity_stable | invariant | Every session has a stable ID and monotonically increasing session revision. | [[spec]] |
| pending_interactions_indexed | invariant | Pending interactions are indexed by stable interaction ID and identify their task and contract revision. | [[spec]] |
| session_serializable | invariant | Durable session state can be serialized and restored without serializing functions, closures, UI nodes, or host handles. | [[spec]] |
| resume_validates_revisions | invariant | Restoring a session revalidates schema, task revision, policy version, and interaction contract compatibility before resuming pending work. | [[spec]] |
| presentation_ephemeral_separate | invariant | Purely visual transient state is not required for domain correctness and is stored separately from durable session state. | [[spec]] |
| concurrent_updates_detected | invariant | Concurrent state updates are resolved by revision preconditions or explicit conflict handling rather than last-write-wins by default. | [[spec]] |
| session_close_explicit | invariant | A session becomes closed only through completion, explicit cancellation, or an explicit administrative recovery action. | [[spec]] |

| resume_reorientation_required | invariant | Restoring serialized session data is not sufficient for resume; continuity state identifies completed, pending, changed, unresolved, and next-attention items. | [[spec]] |
| presentation_state_non_authoritative | invariant | Host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority. | [[spec]] |

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
| suspend_session | open | suspended | [[spec.session_serializable]] |
| begin_recovery | suspended | recovering | [[spec.resume_validates_revisions]] |
| resume_session | recovering | open | [[spec.resume_validates_revisions]] |
| detect_conflict | open | conflicted | [[spec.concurrent_updates_detected]] |
| close_session | open | closed | [[spec.session_close_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| session_identity_stable_holds | unit | [[spec.session_identity_stable]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_identity_stable at its trust boundary and under its stated edge cases.` |
| pending_interactions_indexed_holds | unit | [[spec.pending_interactions_indexed]] | `any::<String>()` | `TypeScript conformance test: assert invariant pending_interactions_indexed at its trust boundary and under its stated edge cases.` |
| session_serializable_holds | unit | [[spec.session_serializable]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_serializable at its trust boundary and under its stated edge cases.` |
| resume_validates_revisions_holds | unit | [[spec.resume_validates_revisions]] | `any::<String>()` | `TypeScript conformance test: assert invariant resume_validates_revisions at its trust boundary and under its stated edge cases.` |
| presentation_ephemeral_separate_holds | unit | [[spec.presentation_ephemeral_separate]] | `any::<String>()` | `TypeScript conformance test: assert invariant presentation_ephemeral_separate at its trust boundary and under its stated edge cases.` |
| concurrent_updates_detected_holds | unit | [[spec.concurrent_updates_detected]] | `any::<String>()` | `TypeScript conformance test: assert invariant concurrent_updates_detected at its trust boundary and under its stated edge cases.` |
| session_close_explicit_holds | unit | [[spec.session_close_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_close_explicit at its trust boundary and under its stated edge cases.` |
| restored_session_reorients | unit | [[spec.resume_reorientation_required]] | `any::<String>()` | `Resume test: continuity summary is derivable before consequential continuation` |
| p_presentation_state_non_authoritative | unit | [[spec.presentation_state_non_authoritative]] | `arbitrary_state()` | `host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority` |

## Requirements

### Requirement: Interaction Session State declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction Session State invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.session_identity_stable_holds]]
- **VERIFIES** [[spec.pending_interactions_indexed_holds]]
- **VERIFIES** [[spec.session_serializable_holds]]
- **VERIFIES** [[spec.resume_validates_revisions_holds]]
- **VERIFIES** [[spec.presentation_ephemeral_separate_holds]]
- **VERIFIES** [[spec.concurrent_updates_detected_holds]]
- **VERIFIES** [[spec.session_close_explicit_holds]]
- **VERIFIES** [[spec.restored_session_reorients]]
- **VERIFIES** [[spec.p_presentation_state_non_authoritative]]

#### Scenario: Violating Interaction Session State invariant is rejected

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
