---
id: change.transaction
kind: intent
statement: THE Change Transaction Layer SHALL apply capability and policy changes as validated, versioned, recoverable transactions
---

# Change Transaction and Revision History

A change transaction records a base revision, candidate revision, validation results, approval requirements, commit result, and recovery pointer. Candidate construction and preview are separate from durable activation. A rollback creates a new revision that points to a previous accepted state; it does not erase the history of the failed or superseded revision.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| base_revision_pinned | invariant | Every change transaction pins the active base revision it was derived from. | [[change.transaction]] |
| optimistic_conflict_checked | invariant | Commit succeeds only if the active revision still matches the transaction base revision or an explicit rebase succeeds. | [[change.transaction]] |
| commit_atomic | invariant | A successful commit changes the active revision pointer atomically with its durable revision record. | [[change.transaction]] |
| validation_evidence_retained | invariant | The committed revision records validation, test, safety, and approval evidence used to accept it. | [[change.transaction]] |
| failed_commit_preserves_active | invariant | A failed or rejected transaction leaves the active revision unchanged. | [[change.transaction]] |
| rollback_is_new_revision | invariant | Rollback creates a new revision referencing the restored prior state and preserves all intervening revision history. | [[change.transaction]] |
| inflight_operations_not_replayed | invariant | Recovery marks interrupted operations and does not automatically replay non-idempotent effects without an explicit recovery policy. | [[change.transaction]] |
| migration_explicit | invariant | Schema or state migrations are versioned, tested, and either committed atomically or leave the prior state active. | [[change.transaction]] |

## Model
### States
- `draft`
- `previewed`
- `validated`
- `awaiting_approval`
- `committed`
- `rejected`
- `conflicted`
- `recovered`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| preview_change | draft | previewed | [[change.transaction.base_revision_pinned]] |
| validate_change | previewed | validated | [[change.transaction.validation_evidence_retained]] |
| request_approval | validated | awaiting_approval | [[change.transaction.commit_atomic]] |
| commit_change | awaiting_approval | committed | [[change.transaction.optimistic_conflict_checked]] |
| reject_change | validated | rejected | ¬([[change.transaction.validation_evidence_retained]]) |
| detect_revision_conflict | awaiting_approval | conflicted | ¬([[change.transaction.optimistic_conflict_checked]]) |
| recover_interrupted_change | conflicted | recovered | [[change.transaction.inflight_operations_not_replayed]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| base_revision_pinned_holds | unit | [[change.transaction.base_revision_pinned]] | `any::<String>()` | `TypeScript conformance test: assert invariant base_revision_pinned at its trust boundary and under its stated edge cases.` |
| optimistic_conflict_checked_holds | unit | [[change.transaction.optimistic_conflict_checked]] | `any::<String>()` | `TypeScript conformance test: assert invariant optimistic_conflict_checked at its trust boundary and under its stated edge cases.` |
| commit_atomic_holds | unit | [[change.transaction.commit_atomic]] | `any::<String>()` | `TypeScript conformance test: assert invariant commit_atomic at its trust boundary and under its stated edge cases.` |
| validation_evidence_retained_holds | unit | [[change.transaction.validation_evidence_retained]] | `any::<String>()` | `TypeScript conformance test: assert invariant validation_evidence_retained at its trust boundary and under its stated edge cases.` |
| failed_commit_preserves_active_holds | unit | [[change.transaction.failed_commit_preserves_active]] | `any::<String>()` | `TypeScript conformance test: assert invariant failed_commit_preserves_active at its trust boundary and under its stated edge cases.` |
| rollback_is_new_revision_holds | unit | [[change.transaction.rollback_is_new_revision]] | `any::<String>()` | `TypeScript conformance test: assert invariant rollback_is_new_revision at its trust boundary and under its stated edge cases.` |
| inflight_operations_not_replayed_holds | unit | [[change.transaction.inflight_operations_not_replayed]] | `any::<String>()` | `TypeScript conformance test: assert invariant inflight_operations_not_replayed at its trust boundary and under its stated edge cases.` |
| migration_explicit_holds | unit | [[change.transaction.migration_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant migration_explicit at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Change Transaction and Revision History model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: preview-change moves `draft` to `previewed`
- **WHEN** the model is in the `draft` state and the `preview_change` transition guard holds ([[change.transaction.base_revision_pinned]])
- **THEN** the model enters the `previewed` state and records the transition
- **VERIFIES** [[change.transaction.base_revision_pinned_holds]]

#### Scenario: validate-change moves `previewed` to `validated`
- **WHEN** the model is in the `previewed` state and the `validate_change` transition guard holds ([[change.transaction.validation_evidence_retained]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[change.transaction.validation_evidence_retained_holds]]

#### Scenario: request-approval moves `validated` to `awaiting_approval`
- **WHEN** the model is in the `validated` state and the `request_approval` transition guard holds ([[change.transaction.commit_atomic]])
- **THEN** the model enters the `awaiting_approval` state and records the transition
- **VERIFIES** [[change.transaction.commit_atomic_holds]]

#### Scenario: commit-change moves `awaiting_approval` to `committed`
- **WHEN** the model is in the `awaiting_approval` state and the `commit_change` transition guard holds ([[change.transaction.optimistic_conflict_checked]])
- **THEN** the model enters the `committed` state and records the transition
- **VERIFIES** [[change.transaction.optimistic_conflict_checked_holds]]

#### Scenario: reject-change moves `validated` to `rejected`
- **WHEN** the model is in the `validated` state and the `reject_change` transition guard evaluates false (¬([[change.transaction.validation_evidence_retained]]))
- **THEN** the model enters the `rejected` state and records the transition
- **VERIFIES** [[change.transaction.validation_evidence_retained_holds]]

#### Scenario: detect-revision-conflict moves `awaiting_approval` to `conflicted`
- **WHEN** the model is in the `awaiting_approval` state and the `detect_revision_conflict` transition guard evaluates false (¬([[change.transaction.optimistic_conflict_checked]]))
- **THEN** the model enters the `conflicted` state and records the transition
- **VERIFIES** [[change.transaction.optimistic_conflict_checked_holds]]

#### Scenario: recover-interrupted-change moves `conflicted` to `recovered`
- **WHEN** the model is in the `conflicted` state and the `recover_interrupted_change` transition guard holds ([[change.transaction.inflight_operations_not_replayed]])
- **THEN** the model enters the `recovered` state and records the transition
- **VERIFIES** [[change.transaction.inflight_operations_not_replayed_holds]]

#### Scenario: failed-commit-preserves-active invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A failed or rejected transaction leaves the active revision unchanged."
- **VERIFIES** [[change.transaction.failed_commit_preserves_active_holds]]

#### Scenario: rollback-is-new-revision invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Rollback creates a new revision referencing the restored prior state and preserves all intervening revision history."
- **VERIFIES** [[change.transaction.rollback_is_new_revision_holds]]

#### Scenario: migration-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Schema or state migrations are versioned, tested, and either committed atomically or leave the prior state active."
- **VERIFIES** [[change.transaction.migration_explicit_holds]]

#### Scenario: Violating Change Transaction and Revision History invariant is rejected

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
