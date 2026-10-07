---
id: spec
kind: intent
statement: WHEN a human task is interrupted or transferred, THE Continuity Layer SHALL preserve enough state and evidence for safe resumption, reorientation, reconciliation, or handoff
---

# Task Continuity

Persistence is not sufficient for continuity. After interruption, the human must be able to understand what was completed, what remains pending, what changed while absent, which effects are uncertain, and what requires attention.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| checkpoint_scope_explicit | invariant | A continuity checkpoint identifies persisted domain/workflow data, uncommitted drafts, active interactions, pending effects, evidence, and deliberately excluded ephemeral presentation state. | [[spec]] |
| resume_reorients_user | invariant | Resumption exposes prior goal/context, last confirmed state, work completed, pending work, changes since suspension, unresolved failures, and required next action before consequential continuation. | [[spec]] |
| interrupted_input_preserved | invariant | Validated but uncommitted user input is preserved across recoverable interruption unless security/privacy policy requires disposal, in which case the loss is explicit. | [[spec]] |
| stale_context_reconciled | invariant | Resume after external or concurrent changes performs version comparison/reconciliation before accepting stale pending actions. | [[spec]] |
| handoff_preserves_ownership | invariant | Human-to-human or human-to-agent handoff records current owner, transferred authority scope, pending decisions, unresolved risks, and evidence references. | [[spec]] |
| presentation_ephemera_not_authoritative | invariant | Scroll position, cursor location, open panel, and host focus may aid restoration but cannot determine authoritative task progress. | [[spec]] |
| reauthentication_preserves_task | invariant | Where policy permits, reauthentication restores the same task context and validated draft without treating authentication success as approval of pending actions. | [[spec]] |

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
| checkpoint_active_task | active | checkpointed | [[spec.checkpoint_scope_explicit]] |
| suspend_checkpoint | checkpointed | suspended | [[spec.interrupted_input_preserved]] |
| begin_reorientation | suspended | reorienting | [[spec.resume_reorients_user]] |
| reconcile_changed_context | reorienting | reconciling | [[spec.stale_context_reconciled]] |
| resume_unchanged_context | reorienting | resumed | [[spec.resume_reorients_user]] |
| resume_reconciled_context | reconciling | resumed | [[spec.stale_context_reconciled]] |
| handoff_task | active | handed_off | [[spec.handoff_preserves_ownership]] |
| abandon_task | active | abandoned | [[spec.handoff_preserves_ownership]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| resume_explains_delta | unit | [[spec.resume_reorients_user]] | `any::<String>()` | `UX contract test: resumed task exposes completed/pending/changed/unresolved/next-action fields` |
| stale_pending_action_not_silently_committed | unit | [[spec.stale_context_reconciled]] | `any::<String>()` | `Concurrency test: changed authoritative revision forces reconciliation before pending action can commit` |
| reauth_does_not_authorize | unit | [[spec.reauthentication_preserves_task]] | `any::<String>()` | `Security test: successful reauthentication cannot satisfy a separate action authorization guard` |
| p_checkpoint_scope_explicit | unit | [[spec.checkpoint_scope_explicit]] | `arbitrary_state()` | `a continuity checkpoint identifies persisted domain/workflow data, uncommitted drafts, active interactions, pending effects, evidence, and deliberately excluded ephemeral presentation state` |
| p_interrupted_input_preserved | unit | [[spec.interrupted_input_preserved]] | `arbitrary_state()` | `validated but uncommitted user input is preserved across recoverable interruption unless security/privacy policy requires disposal, in which case the loss is explicit` |
| p_handoff_preserves_ownership | unit | [[spec.handoff_preserves_ownership]] | `arbitrary_state()` | `human-to-human or human-to-agent handoff records current owner, transferred authority scope, pending decisions, unresolved risks, and evidence references` |
| p_presentation_ephemera_not_authoritative | unit | [[spec.presentation_ephemera_not_authoritative]] | `arbitrary_state()` | `scroll position, cursor location, open panel, and host focus may aid restoration but cannot determine authoritative task progress` |

## Requirements

### Requirement: Task Continuity declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Task Continuity invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.resume_explains_delta]]
- **VERIFIES** [[spec.stale_pending_action_not_silently_committed]]
- **VERIFIES** [[spec.reauth_does_not_authorize]]
- **VERIFIES** [[spec.p_checkpoint_scope_explicit]]
- **VERIFIES** [[spec.p_interrupted_input_preserved]]
- **VERIFIES** [[spec.p_handoff_preserves_ownership]]
- **VERIFIES** [[spec.p_presentation_ephemera_not_authoritative]]

#### Scenario: Violating Task Continuity invariant is rejected

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
