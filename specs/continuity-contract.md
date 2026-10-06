---
id: continuity.contract
kind: intent
statement: WHEN a human task is interrupted or transferred, THE Continuity Layer SHALL preserve enough state and evidence for safe resumption, reorientation, reconciliation, or handoff
---

# Task Continuity

Persistence is not sufficient for continuity. After interruption, the human must be able to understand what was completed, what remains pending, what changed while absent, which effects are uncertain, and what requires attention.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| checkpoint_scope_explicit | invariant | A continuity checkpoint identifies persisted domain/workflow data, uncommitted drafts, active interactions, pending effects, evidence, and deliberately excluded ephemeral presentation state. | [[continuity.contract]] |
| resume_reorients_user | invariant | Resumption exposes prior goal/context, last confirmed state, work completed, pending work, changes since suspension, unresolved failures, and required next action before consequential continuation. | [[continuity.contract]] |
| interrupted_input_preserved | invariant | Validated but uncommitted user input is preserved across recoverable interruption unless security/privacy policy requires disposal, in which case the loss is explicit. | [[continuity.contract]] |
| stale_context_reconciled | invariant | Resume after external or concurrent changes performs version comparison/reconciliation before accepting stale pending actions. | [[continuity.contract]] |
| handoff_preserves_ownership | invariant | Human-to-human or human-to-agent handoff records current owner, transferred authority scope, pending decisions, unresolved risks, and evidence references. | [[continuity.contract]] |
| presentation_ephemera_not_authoritative | invariant | Scroll position, cursor location, open panel, and host focus may aid restoration but cannot determine authoritative task progress. | [[continuity.contract]] |
| reauthentication_preserves_task | invariant | Where policy permits, reauthentication restores the same task context and validated draft without treating authentication success as approval of pending actions. | [[continuity.contract]] |

## Model
### States
- `active`
- `checkpointed`
- `suspended`
- `reorienting`
- `reconciling`
- `resumed`
- `handed_off`
- `abandoned`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| checkpoint_active_task | active | checkpointed | [[continuity.contract.checkpoint_scope_explicit]] |
| suspend_checkpoint | checkpointed | suspended | [[continuity.contract.interrupted_input_preserved]] |
| begin_reorientation | suspended | reorienting | [[continuity.contract.resume_reorients_user]] |
| reconcile_changed_context | reorienting | reconciling | [[continuity.contract.stale_context_reconciled]] |
| resume_unchanged_context | reorienting | resumed | [[continuity.contract.resume_reorients_user]] |
| resume_reconciled_context | reconciling | resumed | [[continuity.contract.stale_context_reconciled]] |
| handoff_task | active | handed_off | [[continuity.contract.handoff_preserves_ownership]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| resume_explains_delta | unit | [[continuity.contract.resume_reorients_user]] | `any::<String>()` | `UX contract test: resumed task exposes completed/pending/changed/unresolved/next-action fields` |
| stale_pending_action_not_silently_committed | unit | [[continuity.contract.stale_context_reconciled]] | `any::<String>()` | `Concurrency test: changed authoritative revision forces reconciliation before pending action can commit` |
| reauth_does_not_authorize | unit | [[continuity.contract.reauthentication_preserves_task]] | `any::<String>()` | `Security test: successful reauthentication cannot satisfy a separate action authorization guard` |
