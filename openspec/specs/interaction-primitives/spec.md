---
id: spec
kind: intent
statement: THE Interaction Primitive System SHALL separate human needs, semantic contributions, compound patterns, presentation, authority, evidence, failure, recovery, and continuity as independently versioned models
---

# Interaction and UI/UX Amplification System Primitives

The core architecture is:

`Human Need -> Contribution Primitive -> Interaction Pattern (optional) -> Interaction Contract -> Presentation Contract -> Host Realization -> Typed Event -> Runtime/Process State -> Effect Boundary`.

Failure paths add `Failure Model -> Recovery Contract -> Continuity/Reorientation`. Authority is orthogonal: a response event can request or evidence authorization, but authority is established only by policy/grants.

## Primitive inventory

- **Human need**: why human participation is required.
- **Contribution primitive**: smallest semantically complete human contribution.
- **Interaction pattern**: reusable composition such as review, clarification, diagnosis, planning, monitoring, or coordination.
- **Interaction contract**: validated request for a contribution.
- **Presentation contract**: host-neutral semantics and accessibility obligations.
- **Process model**: lifecycle, dependencies, waits, completion, cancellation.
- **Authority state**: grants and policy governing protected effects.
- **Evidence/provenance**: why a decision or state exists.
- **Failure model**: typed deviation, scope, effect certainty, recoverability.
- **Recovery contract**: retry/resume/reconcile/restore/rollback/compensate/escalate.
- **Continuity contract**: checkpoint, suspend, reorient, reconcile, resume, handoff.
- **Capability/change transaction**: controlled evolution of reusable application behavior.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| semantic_layers_separated | invariant | Need, contribution primitive, pattern, interaction, presentation, process, authority, evidence, failure, recovery, and continuity have distinct types and update rules. | [[spec]] |
| contribution_precedes_presentation | invariant | Interaction selection is grounded in a normalized need and semantic contribution before a host presentation is chosen. | [[spec]] |
| host_neutral_core | invariant | Core models contain no Pi, DOM, React, browser, TUI toolkit, or MCP SDK types. | [[spec]] |
| contracts_declarative | invariant | Agent-proposed interaction, presentation, workflow, and capability contracts are declarative data and cannot execute generated code in the trusted core. | [[spec]] |
| authority_orthogonal | invariant | Model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority. | [[spec]] |
| failure_and_recovery_first_class | invariant | Failures and recovery actions are represented as typed state with effect certainty and recovery preconditions rather than generic exceptions. | [[spec]] |
| continuity_not_persistence_only | invariant | Resumption includes reorientation and reconciliation semantics, not merely reloading serialized state. | [[spec]] |
| evidence_strength_explicit | invariant | Normative standards, empirical evidence, design guidance, architectural synthesis, and design hypotheses remain distinguishable in provenance. | [[spec]] |

## Model
### States
- `draft`
- `validated`
- `active`
- `rejected`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_system_primitives | draft | validated | [[spec.semantic_layers_separated]] |
| reject_collapsed_model | draft | rejected | ¬([[spec.semantic_layers_separated]]) |
| activate_valid_model | validated | active | [[spec.contracts_declarative]] |
| retire_model_revision | active | retired | [[spec.evidence_strength_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| layers_have_distinct_types | unit | [[spec.semantic_layers_separated]] | `any::<String>()` | `TypeScript compile/schema test: semantic layers cannot be silently substituted for each other` |
| host_specific_types_absent | unit | [[spec.host_neutral_core]] | `any::<String>()` | `Dependency test: core package imports no host UI SDK` |
| failure_paths_are_typed | unit | [[spec.failure_and_recovery_first_class]] | `any::<String>()` | `Graph test: declared mutating operations have typed failure and recovery paths` |
| provenance_distinguishes_evidence_strength | unit | [[spec.evidence_strength_explicit]] | `fc.array(fc.record({claimId: fc.stringMatching(/^e-[a-z0-9]{1,4}$/), evidenceClass: fc.option(fc.constantFrom("normative_standard","empirical_evidence","design_guidance","architectural_synthesis","design_hypothesis"))})) provenance record lists including class-less claims` | `Schema test: imported research claims declare evidence class instead of becoming silently normative` |
| p_contribution_precedes_presentation | unit | [[spec.contribution_precedes_presentation]] | `arbitrary_state()` | `interaction selection is grounded in a normalized need and semantic contribution before a host presentation is chosen` |
| p_contracts_declarative | unit | [[spec.contracts_declarative]] | `arbitrary_state()` | `agent-proposed interaction, presentation, workflow, and capability contracts are declarative data and cannot execute generated code in the trusted core` |
| p_authority_orthogonal | unit | [[spec.authority_orthogonal]] | `fc.array(fc.record({grantId: fc.stringMatching(/^g-[a-z0-9]{1,4}$/), effect: fc.stringMatching(/^[a-z_]{1,10}$/), source: fc.constantFrom("confidence","recommendation","verification","acknowledgement","ui_render","generic_click")})) generic-signal grant sets` | `model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority` |
| p_continuity_not_persistence_only | unit | [[spec.continuity_not_persistence_only]] | `arbitrary_state()` | `resumption includes reorientation and reconciliation semantics, not merely reloading serialized state` |

## Requirements

### Requirement: Interaction and UI/UX Amplification System Primitives model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-system-primitives moves `draft` to `validated`
- **WHEN** the model is in the `draft` state and the `validate_system_primitives` transition guard holds ([[spec.semantic_layers_separated]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.layers_have_distinct_types]]

#### Scenario: reject-collapsed-model moves `draft` to `rejected`
- **WHEN** the model is in the `draft` state and the `reject_collapsed_model` transition guard evaluates false (¬([[spec.semantic_layers_separated]]))
- **THEN** the model enters the `rejected` state and records the transition
- **VERIFIES** [[spec.layers_have_distinct_types]]

#### Scenario: activate-valid-model moves `validated` to `active`
- **WHEN** the model is in the `validated` state and the `activate_valid_model` transition guard holds ([[spec.contracts_declarative]])
- **THEN** the model enters the `active` state and records the transition
- **VERIFIES** [[spec.p_contracts_declarative]]

#### Scenario: retire-model-revision moves `active` to `retired`
- **WHEN** the model is in the `active` state and the `retire_model_revision` transition guard holds ([[spec.evidence_strength_explicit]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[spec.provenance_distinguishes_evidence_strength]]

#### Scenario: contribution-precedes-presentation invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Interaction selection is grounded in a normalized need and semantic contribution before a host presentation is chosen."
- **VERIFIES** [[spec.p_contribution_precedes_presentation]]

#### Scenario: host-neutral-core invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Core models contain no Pi, DOM, React, browser, TUI toolkit, or MCP SDK types."
- **VERIFIES** [[spec.host_specific_types_absent]]

#### Scenario: authority-orthogonal invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority."
- **VERIFIES** [[spec.p_authority_orthogonal]]

#### Scenario: failure-and-recovery-first-class invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Failures and recovery actions are represented as typed state with effect certainty and recovery preconditions rather than generic exceptions."
- **VERIFIES** [[spec.failure_paths_are_typed]]

#### Scenario: continuity-not-persistence-only invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Resumption includes reorientation and reconciliation semantics, not merely reloading serialized state."
- **VERIFIES** [[spec.p_continuity_not_persistence_only]]

#### Scenario: Violating Interaction and UI/UX Amplification System Primitives invariant is rejected

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
