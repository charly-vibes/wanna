---
id: spec
kind: intent
statement: THE Change Transaction Layer SHALL apply capability and policy changes as validated, versioned, recoverable transactions
---

# Change Transaction and Revision History

A change transaction records a base revision, candidate revision, validation results, approval requirements, commit result, and recovery pointer. Candidate construction and preview are separate from durable activation. A rollback creates a new revision that points to a previous accepted state; it does not erase the history of the failed or superseded revision.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| base_revision_pinned | invariant | Every change transaction pins the active base revision it was derived from. | [[spec]] |
| optimistic_conflict_checked | invariant | Commit succeeds only if the active revision still matches the transaction base revision or an explicit rebase succeeds. | [[spec]] |
| commit_atomic | invariant | A successful commit changes the active revision pointer atomically with its durable revision record. | [[spec]] |
| validation_evidence_retained | invariant | The committed revision records validation, test, safety, and approval evidence used to accept it. | [[spec]] |
| failed_commit_preserves_active | invariant | A failed or rejected transaction leaves the active revision unchanged. | [[spec]] |
| rollback_is_new_revision | invariant | Rollback creates a new revision referencing the restored prior state and preserves all intervening revision history. | [[spec]] |
| inflight_operations_not_replayed | invariant | Recovery marks interrupted operations and does not automatically replay non-idempotent effects without an explicit recovery policy. | [[spec]] |
| migration_explicit | invariant | Schema or state migrations are versioned, tested, and either committed atomically or leave the prior state active. | [[spec]] |

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
| preview_change | draft | previewed | [[spec.base_revision_pinned]] |
| validate_change | previewed | validated | [[spec.validation_evidence_retained]] |
| request_approval | validated | awaiting_approval | [[spec.commit_atomic]] |
| commit_change | awaiting_approval | committed | [[spec.optimistic_conflict_checked]] |
| reject_change | validated | rejected | ¬([[spec.validation_evidence_retained]]) |
| detect_revision_conflict | awaiting_approval | conflicted | ¬([[spec.optimistic_conflict_checked]]) |
| recover_interrupted_change | conflicted | recovered | [[spec.inflight_operations_not_replayed]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| base_revision_pinned_holds | unit | [[spec.base_revision_pinned]] | `any::<String>()` | `TypeScript conformance test: assert invariant base_revision_pinned at its trust boundary and under its stated edge cases.` |
| optimistic_conflict_checked_holds | unit | [[spec.optimistic_conflict_checked]] | `any::<String>()` | `TypeScript conformance test: assert invariant optimistic_conflict_checked at its trust boundary and under its stated edge cases.` |
| commit_atomic_holds | unit | [[spec.commit_atomic]] | `any::<String>()` | `TypeScript conformance test: assert invariant commit_atomic at its trust boundary and under its stated edge cases.` |
| validation_evidence_retained_holds | unit | [[spec.validation_evidence_retained]] | `any::<String>()` | `TypeScript conformance test: assert invariant validation_evidence_retained at its trust boundary and under its stated edge cases.` |
| failed_commit_preserves_active_holds | unit | [[spec.failed_commit_preserves_active]] | `any::<String>()` | `TypeScript conformance test: assert invariant failed_commit_preserves_active at its trust boundary and under its stated edge cases.` |
| rollback_is_new_revision_holds | unit | [[spec.rollback_is_new_revision]] | `any::<String>()` | `TypeScript conformance test: assert invariant rollback_is_new_revision at its trust boundary and under its stated edge cases.` |
| inflight_operations_not_replayed_holds | unit | [[spec.inflight_operations_not_replayed]] | `any::<String>()` | `TypeScript conformance test: assert invariant inflight_operations_not_replayed at its trust boundary and under its stated edge cases.` |
| migration_explicit_holds | unit | [[spec.migration_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant migration_explicit at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Change Transaction and Revision History declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Change Transaction and Revision History invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.base_revision_pinned_holds]]
- **VERIFIES** [[spec.optimistic_conflict_checked_holds]]
- **VERIFIES** [[spec.commit_atomic_holds]]
- **VERIFIES** [[spec.validation_evidence_retained_holds]]
- **VERIFIES** [[spec.failed_commit_preserves_active_holds]]
- **VERIFIES** [[spec.rollback_is_new_revision_holds]]
- **VERIFIES** [[spec.inflight_operations_not_replayed_holds]]
- **VERIFIES** [[spec.migration_explicit_holds]]

#### Scenario: Violating a Change Transaction and Revision History invariant is rejected

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
