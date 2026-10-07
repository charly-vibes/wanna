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
| provenance_distinguishes_evidence_strength | unit | [[spec.evidence_strength_explicit]] | `any::<String>()` | `Schema test: imported research claims declare evidence class instead of becoming silently normative` |
| p_contribution_precedes_presentation | unit | [[spec.contribution_precedes_presentation]] | `arbitrary_state()` | `interaction selection is grounded in a normalized need and semantic contribution before a host presentation is chosen` |
| p_contracts_declarative | unit | [[spec.contracts_declarative]] | `arbitrary_state()` | `agent-proposed interaction, presentation, workflow, and capability contracts are declarative data and cannot execute generated code in the trusted core` |
| p_authority_orthogonal | unit | [[spec.authority_orthogonal]] | `arbitrary_state()` | `model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority` |
| p_continuity_not_persistence_only | unit | [[spec.continuity_not_persistence_only]] | `arbitrary_state()` | `resumption includes reorientation and reconciliation semantics, not merely reloading serialized state` |

## Requirements

### Requirement: Interaction and UI/UX Amplification System Primitives declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction and UI/UX Amplification System Primitives invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.layers_have_distinct_types]]
- **VERIFIES** [[spec.host_specific_types_absent]]
- **VERIFIES** [[spec.failure_paths_are_typed]]
- **VERIFIES** [[spec.provenance_distinguishes_evidence_strength]]
- **VERIFIES** [[spec.p_contribution_precedes_presentation]]
- **VERIFIES** [[spec.p_contracts_declarative]]
- **VERIFIES** [[spec.p_authority_orthogonal]]
- **VERIFIES** [[spec.p_continuity_not_persistence_only]]

#### Scenario: Violating a Interaction and UI/UX Amplification System Primitives invariant is rejected

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
