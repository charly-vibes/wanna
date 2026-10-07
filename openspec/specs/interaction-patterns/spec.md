---
id: spec
kind: intent
statement: THE Interaction Pattern Layer SHALL compose contribution primitives into explicit reusable workflows without redefining primitive semantics
---

# Interaction Patterns

Interaction patterns represent recurring compound human activities. Examples include clarification, review, diagnosis, planning, monitoring, coordination, preference teaching, conflict resolution, and recovery assistance. Patterns are process compositions, not new widgets.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| patterns_compose_primitives | invariant | Every pattern identifies the contribution primitives it composes and the process edges connecting them. | [[spec]] |
| pattern_completion_explicit | invariant | A pattern declares success, rejection, cancellation, deferral, failure, and unresolved completion conditions where applicable. | [[spec]] |
| pattern_does_not_override_primitive | invariant | A pattern cannot change the response semantics, validation, authority meaning, or escape semantics of a referenced primitive. | [[spec]] |
| pattern_state_host_neutral | invariant | Pattern progression is independent of DOM, Pi, TUI, component-library, and layout state. | [[spec]] |
| review_separates_judgments | invariant | Review patterns distinguish inspection, evaluation, verification, annotation, rejection, and authorization rather than collapsing them into a generic approval event. | [[spec]] |
| diagnosis_is_iterative_bounded | invariant | Diagnosis patterns explicitly model inspect, hypothesis/evaluation, evidence acquisition, correction proposal, and exit conditions; loops have bounded or externally interruptible termination. | [[spec]] |
| clarification_reduces_unresolved_state | invariant | A clarification step is requested only when its expected response can reduce a represented ambiguity, missing fact, conflict, or decision uncertainty. | [[spec]] |
| pattern_failure_recorded | effect | `interaction.patterns.pattern_failure(detail) — a pattern terminates in failure because detail; the failure is one of the pattern's declared completion conditions per pattern_completion_explicit and is recorded with the pattern instance for replay and audit` | [[spec]] |
| pattern_versioned | invariant | Pattern definitions and their primitive mappings carry explicit versions used in replay and audit. | [[spec]] |

## Model
### States
- `draft`
- `validated`
- `running`
- `waiting`
- `completed`
- `unresolved`
- `cancelled`
- `failed` (emits: `[[spec.pattern_failure_recorded]]`)

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_pattern | draft | validated | [[spec.patterns_compose_primitives]] |
| start_pattern | validated | running | [[spec.pattern_completion_explicit]] |
| wait_for_contribution | running | waiting | [[spec.patterns_compose_primitives]] |
| resume_pattern | waiting | running | [[spec.patterns_compose_primitives]] |
| complete_pattern | running | completed | [[spec.pattern_completion_explicit]] |
| preserve_unresolved_pattern | running | unresolved | ¬([[spec.pattern_completion_explicit]]) |
| cancel_pattern | running | cancelled | [[spec.pattern_completion_explicit]] |
| fail_pattern | running | failed | ¬([[spec.pattern_completion_explicit]] ∨ [[spec.patterns_compose_primitives]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| every_pattern_step_is_semantic | unit | [[spec.patterns_compose_primitives]] | `any::<String>()` | `Graph test: each human-contribution node references a registered primitive` |
| review_does_not_conflate_authority | unit | [[spec.review_separates_judgments]] | `any::<String>()` | `TypeScript test: review can verify without authorizing and authorize only through a distinct event` |
| clarification_has_information_gain_target | unit | [[spec.clarification_reduces_unresolved_state]] | `any::<String>()` | `Policy test: clarification without a named unresolved target is ineligible` |
| pattern_replay_is_versioned | unit | [[spec.pattern_versioned]] | `any::<String>()` | `Replay test: historical pattern events resolve against the recorded pattern version` |
| p_pattern_completion_explicit | unit | [[spec.pattern_completion_explicit]] | `arbitrary_state()` | `a pattern declares success, rejection, cancellation, deferral, failure, and unresolved completion conditions where applicable` |
| p_pattern_does_not_override_primitive | unit | [[spec.pattern_does_not_override_primitive]] | `arbitrary_state()` | `a pattern cannot change the response semantics, validation, authority meaning, or escape semantics of a referenced primitive` |
| p_pattern_state_host_neutral | unit | [[spec.pattern_state_host_neutral]] | `arbitrary_state()` | `pattern progression is independent of DOM, Pi, TUI, component-library, and layout state` |
| p_diagnosis_is_iterative_bounded | unit | [[spec.diagnosis_is_iterative_bounded]] | `arbitrary_state()` | `diagnosis patterns explicitly model inspect, hypothesis/evaluation, evidence acquisition, correction proposal, and exit conditions; loops have bounded or externally interruptible termination` |
| p_pattern_failure_recorded | unit | [[spec.pattern_failure_recorded]] | `arbitrary_failed_pattern()` | `failure is a declared completion condition ∧ instance recorded for replay and audit` |

## Requirements

### Requirement: Interaction Patterns model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-pattern moves `draft` to `validated`
- **WHEN** the model is in the `draft` state and the `validate_pattern` transition guard holds ([[spec.patterns_compose_primitives]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.every_pattern_step_is_semantic]]

#### Scenario: start-pattern moves `validated` to `running`
- **WHEN** the model is in the `validated` state and the `start_pattern` transition guard holds ([[spec.pattern_completion_explicit]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[spec.p_pattern_completion_explicit]]

#### Scenario: wait-for-contribution moves `running` to `waiting`
- **WHEN** the model is in the `running` state and the `wait_for_contribution` transition guard holds ([[spec.patterns_compose_primitives]])
- **THEN** the model enters the `waiting` state and records the transition
- **VERIFIES** [[spec.every_pattern_step_is_semantic]]

#### Scenario: resume-pattern moves `waiting` to `running`
- **WHEN** the model is in the `waiting` state and the `resume_pattern` transition guard holds ([[spec.patterns_compose_primitives]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[spec.every_pattern_step_is_semantic]]

#### Scenario: complete-pattern moves `running` to `completed`
- **WHEN** the model is in the `running` state and the `complete_pattern` transition guard holds ([[spec.pattern_completion_explicit]])
- **THEN** the model enters the `completed` state and records the transition
- **VERIFIES** [[spec.p_pattern_completion_explicit]]

#### Scenario: preserve-unresolved-pattern moves `running` to `unresolved`
- **WHEN** the model is in the `running` state and the `preserve_unresolved_pattern` transition guard evaluates false (¬([[spec.pattern_completion_explicit]]))
- **THEN** the model enters the `unresolved` state and records the transition
- **VERIFIES** [[spec.p_pattern_completion_explicit]]

#### Scenario: cancel-pattern moves `running` to `cancelled`
- **WHEN** the model is in the `running` state and the `cancel_pattern` transition guard holds ([[spec.pattern_completion_explicit]])
- **THEN** the model enters the `cancelled` state and records the transition
- **VERIFIES** [[spec.p_pattern_completion_explicit]]

#### Scenario: fail-pattern moves `running` to `failed`
- **WHEN** the model is in the `running` state and the `fail_pattern` transition guard evaluates false (¬([[spec.pattern_completion_explicit]] ∨ [[spec.patterns_compose_primitives]]))
- **THEN** the model enters the `failed` state and records the transition
- **VERIFIES** [[spec.every_pattern_step_is_semantic]]
- **VERIFIES** [[spec.p_pattern_completion_explicit]]

#### Scenario: pattern-does-not-override-primitive invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A pattern cannot change the response semantics, validation, authority meaning, or escape semantics of a referenced primitive."
- **VERIFIES** [[spec.p_pattern_does_not_override_primitive]]

#### Scenario: pattern-state-host-neutral invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Pattern progression is independent of DOM, Pi, TUI, component-library, and layout state."
- **VERIFIES** [[spec.p_pattern_state_host_neutral]]

#### Scenario: review-separates-judgments invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Review patterns distinguish inspection, evaluation, verification, annotation, rejection, and authorization rather than collapsing them into a generic approval event."
- **VERIFIES** [[spec.review_does_not_conflate_authority]]

#### Scenario: diagnosis-is-iterative-bounded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Diagnosis patterns explicitly model inspect, hypothesis/evaluation, evidence acquisition, correction proposal, and exit conditions; loops have bounded or externally interruptible termination."
- **VERIFIES** [[spec.p_diagnosis_is_iterative_bounded]]

#### Scenario: clarification-reduces-unresolved-state invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A clarification step is requested only when its expected response can reduce a represented ambiguity, missing fact, conflict, or decision uncertainty."
- **VERIFIES** [[spec.clarification_has_information_gain_target]]

#### Scenario: pattern-failure-recorded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "`interaction.patterns.pattern_failure(detail) — a pattern terminates in failure because detail; the failure is one of the pattern's declared completion conditions per pattern_completion_explicit and is recorded with the pattern instance for replay and audit`"
- **VERIFIES** [[spec.p_pattern_failure_recorded]]

#### Scenario: pattern-versioned invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Pattern definitions and their primitive mappings carry explicit versions used in replay and audit."
- **VERIFIES** [[spec.pattern_replay_is_versioned]]

#### Scenario: Violating Interaction Patterns invariant is rejected

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
