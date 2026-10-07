---
id: spec
kind: intent
statement: THE Interaction Policy and Presentation Layers SHALL represent measurable interaction burden and stability constraints without pretending uncertain human-state estimates are deterministic facts
---

# Cognitive Ergonomics and Adaptive Stability

The system should reduce unnecessary memory burden, interruption, choice complexity, and context switching while preserving predictability and user control. Some inputs are objectively measurable (choice count, required recall, step count, destructive consequence); others such as expertise or confusion are uncertain observations and must remain advisory.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| measurable_burden_separated_from_inference | invariant | Objective interaction attributes are stored separately from inferred user-state attributes; inferred expertise, confusion, fatigue, or cognitive burden are labeled uncertain and cannot alone trigger protected actions. | [[spec]] |
| recognition_preferred_when_equivalent | invariant | When semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state. | [[spec]] |
| interruption_has_value_test | invariant | Proactive interruption is eligible only when the policy records the unresolved need, expected benefit, urgency, and why deferral is insufficient. | [[spec]] |
| choice_complexity_bounded | invariant | Large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface. | [[spec]] |
| adaptation_temporally_stable | invariant | An active interaction is not replaced, reordered, or semantically remapped while the user is entering a response unless required for safety or explicitly accepted by the user. | [[spec]] |
| stable_action_identity | invariant | Frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs. | [[spec]] |
| adaptation_explainable_and_overridable | invariant | Material adaptive changes expose a reason and, where safety permits, a way to revert, disable, or choose a stable presentation. | [[spec]] |
| uncertainty_not_fabricated | invariant | The system communicates material uncertainty supported by evidence but does not invent calibrated probabilities or force one visualization technique across domains/modalities. | [[spec]] |

## Model
### States
- `baseline`
- `candidate_adaptation`
- `eligible`
- `applied`
- `deferred`
- `reverted`
- `blocked`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| propose_adaptation | baseline | candidate_adaptation | [[spec.measurable_burden_separated_from_inference]] |
| admit_stable_adaptation | candidate_adaptation | eligible | [[spec.adaptation_temporally_stable]] |
| block_disruptive_adaptation | candidate_adaptation | blocked | ¬([[spec.adaptation_temporally_stable]]) |
| apply_adaptation | eligible | applied | [[spec.adaptation_explainable_and_overridable]] |
| defer_interruption | eligible | deferred | ¬([[spec.interruption_has_value_test]]) |
| revert_adaptation | applied | reverted | [[spec.adaptation_explainable_and_overridable]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| active_control_not_replaced_mid_input | unit | [[spec.adaptation_temporally_stable]] | `any::<String>()` | `Interaction test: non-safety adaptation cannot replace or reorder the active response surface during entry` |
| inferred_confusion_cannot_authorize | unit | [[spec.measurable_burden_separated_from_inference]] | `any::<String>()` | `Policy test: inferred human state never satisfies an authority guard` |
| interruption_requires_reason | unit | [[spec.interruption_has_value_test]] | `any::<String>()` | `Policy test: proactive interrupt without need/benefit/urgency/deferral rationale is ineligible` |
| uncertainty_requires_evidence | unit | [[spec.uncertainty_not_fabricated]] | `any::<String>()` | `TypeScript test: UI cannot render a numeric confidence absent a source declaring that metric and semantics` |
| p_recognition_preferred_when_equivalent | unit | [[spec.recognition_preferred_when_equivalent]] | `arbitrary_state()` | `when semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state` |
| p_choice_complexity_bounded | unit | [[spec.choice_complexity_bounded]] | `arbitrary_state()` | `large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface` |
| p_stable_action_identity | unit | [[spec.stable_action_identity]] | `arbitrary_state()` | `frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs` |
| p_adaptation_explainable_and_overridable | unit | [[spec.adaptation_explainable_and_overridable]] | `arbitrary_state()` | `material adaptive changes expose a reason and, where safety permits, a way to revert, disable, or choose a stable presentation` |

## Requirements

### Requirement: Cognitive Ergonomics and Adaptive Stability model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: propose-adaptation moves `baseline` to `candidate_adaptation`
- **WHEN** the model is in the `baseline` state and the `propose_adaptation` transition guard holds ([[spec.measurable_burden_separated_from_inference]])
- **THEN** the model enters the `candidate_adaptation` state and records the transition
- **VERIFIES** [[spec.inferred_confusion_cannot_authorize]]

#### Scenario: admit-stable-adaptation moves `candidate_adaptation` to `eligible`
- **WHEN** the model is in the `candidate_adaptation` state and the `admit_stable_adaptation` transition guard holds ([[spec.adaptation_temporally_stable]])
- **THEN** the model enters the `eligible` state and records the transition
- **VERIFIES** [[spec.active_control_not_replaced_mid_input]]

#### Scenario: block-disruptive-adaptation moves `candidate_adaptation` to `blocked`
- **WHEN** the model is in the `candidate_adaptation` state and the `block_disruptive_adaptation` transition guard evaluates false (¬([[spec.adaptation_temporally_stable]]))
- **THEN** the model enters the `blocked` state and records the transition
- **VERIFIES** [[spec.active_control_not_replaced_mid_input]]

#### Scenario: apply-adaptation moves `eligible` to `applied`
- **WHEN** the model is in the `eligible` state and the `apply_adaptation` transition guard holds ([[spec.adaptation_explainable_and_overridable]])
- **THEN** the model enters the `applied` state and records the transition
- **VERIFIES** [[spec.p_adaptation_explainable_and_overridable]]

#### Scenario: defer-interruption moves `eligible` to `deferred`
- **WHEN** the model is in the `eligible` state and the `defer_interruption` transition guard evaluates false (¬([[spec.interruption_has_value_test]]))
- **THEN** the model enters the `deferred` state and records the transition
- **VERIFIES** [[spec.interruption_requires_reason]]

#### Scenario: revert-adaptation moves `applied` to `reverted`
- **WHEN** the model is in the `applied` state and the `revert_adaptation` transition guard holds ([[spec.adaptation_explainable_and_overridable]])
- **THEN** the model enters the `reverted` state and records the transition
- **VERIFIES** [[spec.p_adaptation_explainable_and_overridable]]

#### Scenario: recognition-preferred-when-equivalent invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "When semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state."
- **VERIFIES** [[spec.p_recognition_preferred_when_equivalent]]

#### Scenario: choice-complexity-bounded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface."
- **VERIFIES** [[spec.p_choice_complexity_bounded]]

#### Scenario: stable-action-identity invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs."
- **VERIFIES** [[spec.p_stable_action_identity]]

#### Scenario: uncertainty-not-fabricated invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The system communicates material uncertainty supported by evidence but does not invent calibrated probabilities or force one visualization technique across domains/modalities."
- **VERIFIES** [[spec.uncertainty_requires_evidence]]

#### Scenario: Violating Cognitive Ergonomics and Adaptive Stability invariant is rejected

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
