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
| abandon_task | active | abandoned | [[continuity.contract.handoff_preserves_ownership]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| resume_explains_delta | unit | [[continuity.contract.resume_reorients_user]] | `any::<String>()` | `UX contract test: resumed task exposes completed/pending/changed/unresolved/next-action fields` |
| stale_pending_action_not_silently_committed | unit | [[continuity.contract.stale_context_reconciled]] | `any::<String>()` | `Concurrency test: changed authoritative revision forces reconciliation before pending action can commit` |
| reauth_does_not_authorize | unit | [[continuity.contract.reauthentication_preserves_task]] | `any::<String>()` | `Security test: successful reauthentication cannot satisfy a separate action authorization guard` |
| p_checkpoint_scope_explicit | unit | [[continuity.contract.checkpoint_scope_explicit]] | `arbitrary_state()` | `a continuity checkpoint identifies persisted domain/workflow data, uncommitted drafts, active interactions, pending effects, evidence, and deliberately excluded ephemeral presentation state` |
| p_interrupted_input_preserved | unit | [[continuity.contract.interrupted_input_preserved]] | `arbitrary_state()` | `validated but uncommitted user input is preserved across recoverable interruption unless security/privacy policy requires disposal, in which case the loss is explicit` |
| p_handoff_preserves_ownership | unit | [[continuity.contract.handoff_preserves_ownership]] | `arbitrary_state()` | `human-to-human or human-to-agent handoff records current owner, transferred authority scope, pending decisions, unresolved risks, and evidence references` |
| p_presentation_ephemera_not_authoritative | unit | [[continuity.contract.presentation_ephemera_not_authoritative]] | `arbitrary_state()` | `scroll position, cursor location, open panel, and host focus may aid restoration but cannot determine authoritative task progress` |

## Requirements

### Requirement: Task Continuity model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: checkpoint-active-task moves `active` to `checkpointed`
- **WHEN** the model is in the `active` state and the `checkpoint_active_task` transition guard holds ([[continuity.contract.checkpoint_scope_explicit]])
- **THEN** the model enters the `checkpointed` state and records the transition
- **VERIFIES** [[continuity.contract.p_checkpoint_scope_explicit]]

#### Scenario: suspend-checkpoint moves `checkpointed` to `suspended`
- **WHEN** the model is in the `checkpointed` state and the `suspend_checkpoint` transition guard holds ([[continuity.contract.interrupted_input_preserved]])
- **THEN** the model enters the `suspended` state and records the transition
- **VERIFIES** [[continuity.contract.p_interrupted_input_preserved]]

#### Scenario: begin-reorientation moves `suspended` to `reorienting`
- **WHEN** the model is in the `suspended` state and the `begin_reorientation` transition guard holds ([[continuity.contract.resume_reorients_user]])
- **THEN** the model enters the `reorienting` state and records the transition
- **VERIFIES** [[continuity.contract.resume_explains_delta]]

#### Scenario: reconcile-changed-context moves `reorienting` to `reconciling`
- **WHEN** the model is in the `reorienting` state and the `reconcile_changed_context` transition guard holds ([[continuity.contract.stale_context_reconciled]])
- **THEN** the model enters the `reconciling` state and records the transition
- **VERIFIES** [[continuity.contract.stale_pending_action_not_silently_committed]]

#### Scenario: resume-unchanged-context moves `reorienting` to `resumed`
- **WHEN** the model is in the `reorienting` state and the `resume_unchanged_context` transition guard holds ([[continuity.contract.resume_reorients_user]])
- **THEN** the model enters the `resumed` state and records the transition
- **VERIFIES** [[continuity.contract.resume_explains_delta]]

#### Scenario: resume-reconciled-context moves `reconciling` to `resumed`
- **WHEN** the model is in the `reconciling` state and the `resume_reconciled_context` transition guard holds ([[continuity.contract.stale_context_reconciled]])
- **THEN** the model enters the `resumed` state and records the transition
- **VERIFIES** [[continuity.contract.stale_pending_action_not_silently_committed]]

#### Scenario: handoff-task moves `active` to `handed_off`
- **WHEN** the model is in the `active` state and the `handoff_task` transition guard holds ([[continuity.contract.handoff_preserves_ownership]])
- **THEN** the model enters the `handed_off` state and records the transition
- **VERIFIES** [[continuity.contract.p_handoff_preserves_ownership]]

#### Scenario: abandon-task moves `active` to `abandoned`
- **WHEN** the model is in the `active` state and the `abandon_task` transition guard holds ([[continuity.contract.handoff_preserves_ownership]])
- **THEN** the model enters the `abandoned` state and records the transition
- **VERIFIES** [[continuity.contract.p_handoff_preserves_ownership]]

#### Scenario: presentation-ephemera-not-authoritative invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Scroll position, cursor location, open panel, and host focus may aid restoration but cannot determine authoritative task progress."
- **VERIFIES** [[continuity.contract.p_presentation_ephemera_not_authoritative]]

#### Scenario: reauthentication-preserves-task invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Where policy permits, reauthentication restores the same task context and validated draft without treating authentication success as approval of pending actions."
- **VERIFIES** [[continuity.contract.reauth_does_not_authorize]]

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
