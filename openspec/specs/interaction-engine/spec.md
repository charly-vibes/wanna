---
id: interaction.engine
kind: intent
statement: THE Interaction Engine SHALL evaluate normalized interaction needs through a host-neutral deterministic core
---

# Interaction Engine

The engine orchestrates the decision boundary between an agent's proposed human-contribution need and the trusted interaction policy/catalog. It returns decision data only; it does not render UI, execute external actions, or grant authority.

## Constraints

| id | kind | expr | traces_to |
|---|---|---|---|
| context_schema_valid | invariant | Every context entering policy evaluation validates against the declared context schema and contains task identity, task revision, normalized need, available catalog version, and policy version. | [[interaction.engine]] |
| policy_catalog_versions_pinned | invariant | One evaluation uses exactly one immutable policy version and one immutable interaction-catalog version, and includes both versions in its result. | [[interaction.engine]] |
| deterministic_decision | invariant | Equal canonical contexts evaluated with equal policy/catalog versions produce structurally equal decision results, including proposal ordering and reason codes. | [[interaction.engine]] |
| context_version_current | invariant | A decision may be committed only if the task revision used to compute it is still current at the commit boundary. | [[interaction.engine]] |
| no_effects_in_core | invariant | Evaluation and reduction expose requested external work as data and perform no filesystem, network, UI, model, or domain side effects. | [[interaction.engine]] |
| host_neutral_types | invariant | Public core types contain no Pi, DOM, browser, React, TUI-library, or MCP-SDK types. | [[interaction.engine]] |
| rejected_context_not_committed | invariant | A malformed or stale context never produces a committed active interaction and leaves the prior committed task state unchanged. | [[interaction.engine]] |
| corrected_context_received | invariant | Leaving an invalid or stale context state for a new draft requires an explicitly newly received context snapshot. | [[interaction.engine]] |
| retirement_requested | invariant | A committed decision is retired only in response to an explicit retire, cancel, supersede, or expiry command. | [[interaction.engine]] |
| retain_decision_provenance | invariant | Every decision result records normalized need, task revision, policy/catalog versions, ordered candidates, exclusions, and stable reason codes. | [[interaction.engine]] |

## Model

### States
- `draft`
- `normalized`
- `evaluated`
- `committed`
- `invalid_context`
- `stale_context`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| accept_context | draft | normalized | [[interaction.engine.context_schema_valid]] |
| reject_invalid_context | draft | invalid_context | ¬([[interaction.engine.context_schema_valid]]) |
| correct_invalid_context | invalid_context | draft | [[interaction.engine.corrected_context_received]] |
| evaluate_pinned_context | normalized | evaluated | [[interaction.engine.policy_catalog_versions_pinned]] |
| commit_current_decision | evaluated | committed | [[interaction.engine.context_version_current]] |
| reject_stale_decision | evaluated | stale_context | ¬([[interaction.engine.context_version_current]]) |
| refresh_stale_context | stale_context | draft | [[interaction.engine.corrected_context_received]] |
| retire_committed_decision | committed | retired | [[interaction.engine.retirement_requested]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| context_validation_rejects_malformed | unit | [[interaction.engine.context_schema_valid]] | `any::<String>()` | `TypeScript test: malformed context is rejected before policy evaluation` |
| evaluation_versions_are_pinned | unit | [[interaction.engine.policy_catalog_versions_pinned]] | `any::<String>()` | `TypeScript test: result carries the exact policy and catalog versions used` |
| identical_inputs_are_deterministic | unit | [[interaction.engine.deterministic_decision]] | `fc.record({taskId: fc.string({minLength:1}), taskRevision: fc.nat(), need: fc.string({minLength:1}), catalogVersion: fc.string({minLength:1}), policyVersion: fc.string({minLength:1})}) x fc.record({version: fc.string({minLength:1}), candidates: fc.array(fc.record({id: fc.string({minLength:1}), priority: fc.integer()}))})` | `TypeScript test: repeated evaluation returns deeply equal ordered results` |
| stale_result_is_not_committed | unit | [[interaction.engine.context_version_current]] | `fc.nat({max:1000000}) base revision x fc.integer({min:1,max:100}) revision bumps under the evaluated decision` | `TypeScript test: task revision change between evaluation and commit prevents commit and preserves prior committed state` |
| core_has_no_host_or_io_imports | unit | [[interaction.engine.host_neutral_types]] | `any::<String>()` | `Static TypeScript test: forbidden host imports and ambient host types are absent from core` |
| rejection_preserves_state | unit | [[interaction.engine.rejected_context_not_committed]] | `any::<String>()` | `TypeScript test: invalid and stale contexts do not mutate committed task state` |
| corrected_context_reenters_draft | unit | [[interaction.engine.corrected_context_received]] | `any::<String>()` | `TypeScript test: rejected context can re-enter draft only after an explicit new snapshot arrives` |
| retirement_is_explicit | unit | [[interaction.engine.retirement_requested]] | `any::<String>()` | `TypeScript test: committed decision retires only after explicit retire/cancel/supersede/expiry command` |
| decision_has_provenance | unit | [[interaction.engine.retain_decision_provenance]] | `any::<String>()` | `TypeScript test: every result includes input revision, policy/catalog versions, candidates, exclusions and reason codes` |
| core_evaluation_has_no_effects | unit | [[interaction.engine.no_effects_in_core]] | `any::<String>()` | `Static TypeScript test: core calls no I/O, rendering, model inference or domain-action ports` |

## Requirements

### Requirement: Interaction Engine model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: accept-context moves `draft` to `normalized`
- **WHEN** the model is in the `draft` state and the `accept_context` transition guard holds ([[interaction.engine.context_schema_valid]])
- **THEN** the model enters the `normalized` state and records the transition
- **VERIFIES** [[interaction.engine.context_validation_rejects_malformed]]

#### Scenario: reject-invalid-context moves `draft` to `invalid_context`
- **WHEN** the model is in the `draft` state and the `reject_invalid_context` transition guard evaluates false (¬([[interaction.engine.context_schema_valid]]))
- **THEN** the model enters the `invalid_context` state and records the transition
- **VERIFIES** [[interaction.engine.context_validation_rejects_malformed]]

#### Scenario: correct-invalid-context moves `invalid_context` to `draft`
- **WHEN** the model is in the `invalid_context` state and the `correct_invalid_context` transition guard holds ([[interaction.engine.corrected_context_received]])
- **THEN** the model enters the `draft` state and records the transition
- **VERIFIES** [[interaction.engine.corrected_context_reenters_draft]]

#### Scenario: evaluate-pinned-context moves `normalized` to `evaluated`
- **WHEN** the model is in the `normalized` state and the `evaluate_pinned_context` transition guard holds ([[interaction.engine.policy_catalog_versions_pinned]])
- **THEN** the model enters the `evaluated` state and records the transition
- **VERIFIES** [[interaction.engine.evaluation_versions_are_pinned]]

#### Scenario: commit-current-decision moves `evaluated` to `committed`
- **WHEN** the model is in the `evaluated` state and the `commit_current_decision` transition guard holds ([[interaction.engine.context_version_current]])
- **THEN** the model enters the `committed` state and records the transition
- **VERIFIES** [[interaction.engine.stale_result_is_not_committed]]

#### Scenario: reject-stale-decision moves `evaluated` to `stale_context`
- **WHEN** the model is in the `evaluated` state and the `reject_stale_decision` transition guard evaluates false (¬([[interaction.engine.context_version_current]]))
- **THEN** the model enters the `stale_context` state and records the transition
- **VERIFIES** [[interaction.engine.stale_result_is_not_committed]]

#### Scenario: refresh-stale-context moves `stale_context` to `draft`
- **WHEN** the model is in the `stale_context` state and the `refresh_stale_context` transition guard holds ([[interaction.engine.corrected_context_received]])
- **THEN** the model enters the `draft` state and records the transition
- **VERIFIES** [[interaction.engine.corrected_context_reenters_draft]]

#### Scenario: retire-committed-decision moves `committed` to `retired`
- **WHEN** the model is in the `committed` state and the `retire_committed_decision` transition guard holds ([[interaction.engine.retirement_requested]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[interaction.engine.retirement_is_explicit]]

#### Scenario: deterministic-decision invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Equal canonical contexts evaluated with equal policy/catalog versions produce structurally equal decision results, including proposal ordering and reason codes."
- **VERIFIES** [[interaction.engine.identical_inputs_are_deterministic]]

#### Scenario: no-effects-in-core invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Evaluation and reduction expose requested external work as data and perform no filesystem, network, UI, model, or domain side effects."
- **VERIFIES** [[interaction.engine.core_evaluation_has_no_effects]]

#### Scenario: host-neutral-types invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Public core types contain no Pi, DOM, browser, React, TUI-library, or MCP-SDK types."
- **VERIFIES** [[interaction.engine.core_has_no_host_or_io_imports]]

#### Scenario: rejected-context-not-committed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A malformed or stale context never produces a committed active interaction and leaves the prior committed task state unchanged."
- **VERIFIES** [[interaction.engine.rejection_preserves_state]]

#### Scenario: retain-decision-provenance invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every decision result records normalized need, task revision, policy/catalog versions, ordered candidates, exclusions, and stable reason codes."
- **VERIFIES** [[interaction.engine.decision_has_provenance]]

#### Scenario: Violating Interaction Engine invariant is rejected

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
