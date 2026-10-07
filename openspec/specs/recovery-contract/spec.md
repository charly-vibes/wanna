---
id: spec
kind: intent
statement: THE Recovery Layer SHALL select only recovery operations whose preconditions are satisfied by the typed failure and current authoritative state
---

# Recovery Contract

Recovery operations have different semantics and must not be conflated: `retry`, `resume`, `reconcile`, `restore`, `rollback`, `compensate`, `restart`, `abort`, `escalate`, and `take_over`.

Rollback restores managed internal state. Compensation performs a new action intended to offset a previously completed external effect. They are not equivalent.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| recovery_operation_typed | invariant | Every recovery attempt names one supported recovery operation and its preconditions. | [[spec]] |
| retry_requires_safety | invariant | Retry of a mutating operation is permitted only when idempotency is proven for the same operation key or reconciliation proves the prior effect did not occur. | [[spec]] |
| reconcile_precedes_unknown_retry | invariant | An `effect_unknown` failure cannot retry a non-idempotent mutation before reconciliation resolves effect state. | [[spec]] |
| rollback_not_compensation | invariant | Internal rollback cannot be represented as undoing an external effect; external effects require a declared compensation or explicit residual-effect record. | [[spec]] |
| compensation_is_new_effect | invariant | A compensating action is itself authorized, observable, failure-prone, and auditable as a new effect. | [[spec]] |
| recovery_preserves_evidence | invariant | Recovery never deletes the original failure/effect evidence; new recovery events append lineage. | [[spec]] |
| recovery_verification_required | invariant | A recovery reaches `recovered` only after declared post-recovery invariants are checked; otherwise it remains unresolved or escalated. | [[spec]] |
| user_control_available | invariant | When recovery requires human judgment, the interaction exposes valid alternatives including safe abort/escalation rather than forcing a single repair path. | [[spec]] |

## Model
### States
- `proposed`
- `eligible`
- `executing`
- `verifying`
- `recovered`
- `unresolved`
- `blocked`
- `escalated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_recovery | proposed | eligible | [[spec.recovery_operation_typed]] |
| block_unsafe_recovery | proposed | blocked | ¬([[spec.recovery_operation_typed]]) |
| execute_recovery | eligible | executing | [[spec.retry_requires_safety]] |
| verify_recovery | executing | verifying | [[spec.recovery_verification_required]] |
| accept_recovery | verifying | recovered | [[spec.recovery_verification_required]] |
| preserve_failed_recovery | verifying | unresolved | ¬([[spec.recovery_verification_required]]) |
| escalate_recovery | unresolved | escalated | [[spec.user_control_available]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| unknown_nonidempotent_effect_never_retries | unit | [[spec.reconcile_precedes_unknown_retry]] | `any::<String>()` | `Property test: all paths from effect_unknown + non-idempotent mutation to retry pass through successful reconciliation` |
| rollback_cannot_claim_external_undo | unit | [[spec.rollback_not_compensation]] | `any::<String>()` | `TypeScript test: rollback result with external effects records residual effects unless compensation succeeds` |
| compensation_has_own_failure_path | unit | [[spec.compensation_is_new_effect]] | `any::<String>()` | `Fault-injection test: compensation failure remains visible and cannot mark original operation recovered` |
| recovery_requires_postcheck | unit | [[spec.recovery_verification_required]] | `any::<String>()` | `Model test: no recovery path reaches recovered without post-condition evaluation` |
| p_recovery_operation_typed | unit | [[spec.recovery_operation_typed]] | `arbitrary_state()` | `every recovery attempt names one supported recovery operation and its preconditions` |
| p_retry_requires_safety | unit | [[spec.retry_requires_safety]] | `arbitrary_state()` | `retry of a mutating operation is permitted only when idempotency is proven for the same operation key or reconciliation proves the prior effect did not occur` |
| p_recovery_preserves_evidence | unit | [[spec.recovery_preserves_evidence]] | `arbitrary_state()` | `recovery never deletes the original failure/effect evidence; new recovery events append lineage` |
| p_user_control_available | unit | [[spec.user_control_available]] | `arbitrary_state()` | `when recovery requires human judgment, the interaction exposes valid alternatives including safe abort/escalation rather than forcing a single repair path` |

## Requirements

### Requirement: Recovery Contract declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Recovery Contract invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.unknown_nonidempotent_effect_never_retries]]
- **VERIFIES** [[spec.rollback_cannot_claim_external_undo]]
- **VERIFIES** [[spec.compensation_has_own_failure_path]]
- **VERIFIES** [[spec.recovery_requires_postcheck]]
- **VERIFIES** [[spec.p_recovery_operation_typed]]
- **VERIFIES** [[spec.p_retry_requires_safety]]
- **VERIFIES** [[spec.p_recovery_preserves_evidence]]
- **VERIFIES** [[spec.p_user_control_available]]

#### Scenario: Violating Recovery Contract invariant is rejected

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
