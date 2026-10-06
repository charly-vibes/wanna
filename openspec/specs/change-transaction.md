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
