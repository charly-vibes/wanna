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
| session_serializable_holds | unit | [[spec.session_serializable]] | `fc.nat({max:1e6}) session seeds x fc.dictionary(fc.constantFrom("note","alpha","beta","gamma"), fc.oneof(fc.string({maxLength:32}), fc.integer(), fc.boolean(), fc.constant(null))) plain snapshots, plus fc.func function-bearing snapshots for the negative path` | `TypeScript conformance test: assert invariant session_serializable at its trust boundary and under its stated edge cases.` |
| resume_validates_revisions_holds | unit | [[spec.resume_validates_revisions]] | `any::<String>()` | `TypeScript conformance test: assert invariant resume_validates_revisions at its trust boundary and under its stated edge cases.` |
| presentation_ephemeral_separate_holds | unit | [[spec.presentation_ephemeral_separate]] | `any::<String>()` | `TypeScript conformance test: assert invariant presentation_ephemeral_separate at its trust boundary and under its stated edge cases.` |
| concurrent_updates_detected_holds | unit | [[spec.concurrent_updates_detected]] | `fc.integer({min:1,max:1e6}) base revisions x fc.integer({min:1,max:1e6}) current revisions` | `TypeScript conformance test: assert invariant concurrent_updates_detected at its trust boundary and under its stated edge cases.` |
| session_close_explicit_holds | unit | [[spec.session_close_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant session_close_explicit at its trust boundary and under its stated edge cases.` |
| restored_session_reorients | unit | [[spec.resume_reorientation_required]] | `any::<String>()` | `Resume test: continuity summary is derivable before consequential continuation` |
| p_presentation_state_non_authoritative | unit | [[spec.presentation_state_non_authoritative]] | `arbitrary_state()` | `host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority` |

## Requirements

### Requirement: Interaction Session State model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: suspend-session moves `open` to `suspended`
- **WHEN** the model is in the `open` state and the `suspend_session` transition guard holds ([[spec.session_serializable]])
- **THEN** the model enters the `suspended` state and records the transition
- **VERIFIES** [[spec.session_serializable_holds]]

#### Scenario: begin-recovery moves `suspended` to `recovering`
- **WHEN** the model is in the `suspended` state and the `begin_recovery` transition guard holds ([[spec.resume_validates_revisions]])
- **THEN** the model enters the `recovering` state and records the transition
- **VERIFIES** [[spec.resume_validates_revisions_holds]]

#### Scenario: resume-session moves `recovering` to `open`
- **WHEN** the model is in the `recovering` state and the `resume_session` transition guard holds ([[spec.resume_validates_revisions]])
- **THEN** the model enters the `open` state and records the transition
- **VERIFIES** [[spec.resume_validates_revisions_holds]]

#### Scenario: detect-conflict moves `open` to `conflicted`
- **WHEN** the model is in the `open` state and the `detect_conflict` transition guard holds ([[spec.concurrent_updates_detected]])
- **THEN** the model enters the `conflicted` state and records the transition
- **VERIFIES** [[spec.concurrent_updates_detected_holds]]

#### Scenario: close-session moves `open` to `closed`
- **WHEN** the model is in the `open` state and the `close_session` transition guard holds ([[spec.session_close_explicit]])
- **THEN** the model enters the `closed` state and records the transition
- **VERIFIES** [[spec.session_close_explicit_holds]]

#### Scenario: session-identity-stable invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every session has a stable ID and monotonically increasing session revision."
- **VERIFIES** [[spec.session_identity_stable_holds]]

#### Scenario: pending-interactions-indexed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Pending interactions are indexed by stable interaction ID and identify their task and contract revision."
- **VERIFIES** [[spec.pending_interactions_indexed_holds]]

#### Scenario: presentation-ephemeral-separate invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Purely visual transient state is not required for domain correctness and is stored separately from durable session state."
- **VERIFIES** [[spec.presentation_ephemeral_separate_holds]]

#### Scenario: resume-reorientation-required invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Restoring serialized session data is not sufficient for resume; continuity state identifies completed, pending, changed, unresolved, and next-attention items."
- **VERIFIES** [[spec.restored_session_reorients]]

#### Scenario: presentation-state-non-authoritative invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority."
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
