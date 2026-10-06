---
id: recovery.contract
kind: intent
statement: THE Recovery Layer SHALL select only recovery operations whose preconditions are satisfied by the typed failure and current authoritative state
---

# Recovery Contract

Recovery operations have different semantics and must not be conflated: `retry`, `resume`, `reconcile`, `restore`, `rollback`, `compensate`, `restart`, `abort`, `escalate`, and `take_over`.

Rollback restores managed internal state. Compensation performs a new action intended to offset a previously completed external effect. They are not equivalent.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| recovery_operation_typed | invariant | Every recovery attempt names one supported recovery operation and its preconditions. | [[recovery.contract]] |
| retry_requires_safety | invariant | Retry of a mutating operation is permitted only when idempotency is proven for the same operation key or reconciliation proves the prior effect did not occur. | [[recovery.contract]] |
| reconcile_precedes_unknown_retry | invariant | An `effect_unknown` failure cannot retry a non-idempotent mutation before reconciliation resolves effect state. | [[recovery.contract]] |
| rollback_not_compensation | invariant | Internal rollback cannot be represented as undoing an external effect; external effects require a declared compensation or explicit residual-effect record. | [[recovery.contract]] |
| compensation_is_new_effect | invariant | A compensating action is itself authorized, observable, failure-prone, and auditable as a new effect. | [[recovery.contract]] |
| recovery_preserves_evidence | invariant | Recovery never deletes the original failure/effect evidence; new recovery events append lineage. | [[recovery.contract]] |
| recovery_verification_required | invariant | A recovery reaches `recovered` only after declared post-recovery invariants are checked; otherwise it remains unresolved or escalated. | [[recovery.contract]] |
| user_control_available | invariant | When recovery requires human judgment, the interaction exposes valid alternatives including safe abort/escalation rather than forcing a single repair path. | [[recovery.contract]] |

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
| validate_recovery | proposed | eligible | [[recovery.contract.recovery_operation_typed]] |
| block_unsafe_recovery | proposed | blocked | ¬([[recovery.contract.recovery_operation_typed]]) |
| execute_recovery | eligible | executing | [[recovery.contract.retry_requires_safety]] |
| verify_recovery | executing | verifying | [[recovery.contract.recovery_verification_required]] |
| accept_recovery | verifying | recovered | [[recovery.contract.recovery_verification_required]] |
| preserve_failed_recovery | verifying | unresolved | ¬([[recovery.contract.recovery_verification_required]]) |
| escalate_recovery | unresolved | escalated | [[recovery.contract.user_control_available]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| unknown_nonidempotent_effect_never_retries | unit | [[recovery.contract.reconcile_precedes_unknown_retry]] | `any::<String>()` | `Property test: all paths from effect_unknown + non-idempotent mutation to retry pass through successful reconciliation` |
| rollback_cannot_claim_external_undo | unit | [[recovery.contract.rollback_not_compensation]] | `any::<String>()` | `TypeScript test: rollback result with external effects records residual effects unless compensation succeeds` |
| compensation_has_own_failure_path | unit | [[recovery.contract.compensation_is_new_effect]] | `any::<String>()` | `Fault-injection test: compensation failure remains visible and cannot mark original operation recovered` |
| recovery_requires_postcheck | unit | [[recovery.contract.recovery_verification_required]] | `any::<String>()` | `Model test: no recovery path reaches recovered without post-condition evaluation` |
| p_recovery_operation_typed | unit | [[recovery.contract.recovery_operation_typed]] | `arbitrary_state()` | `every recovery attempt names one supported recovery operation and its preconditions` |
| p_retry_requires_safety | unit | [[recovery.contract.retry_requires_safety]] | `arbitrary_state()` | `retry of a mutating operation is permitted only when idempotency is proven for the same operation key or reconciliation proves the prior effect did not occur` |
| p_recovery_preserves_evidence | unit | [[recovery.contract.recovery_preserves_evidence]] | `arbitrary_state()` | `recovery never deletes the original failure/effect evidence; new recovery events append lineage` |
| p_user_control_available | unit | [[recovery.contract.user_control_available]] | `arbitrary_state()` | `when recovery requires human judgment, the interaction exposes valid alternatives including safe abort/escalation rather than forcing a single repair path` |
