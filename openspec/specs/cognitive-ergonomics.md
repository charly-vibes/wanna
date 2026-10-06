---
id: cognitive.ergonomics
kind: intent
statement: THE Interaction Policy and Presentation Layers SHALL represent measurable interaction burden and stability constraints without pretending uncertain human-state estimates are deterministic facts
---

# Cognitive Ergonomics and Adaptive Stability

The system should reduce unnecessary memory burden, interruption, choice complexity, and context switching while preserving predictability and user control. Some inputs are objectively measurable (choice count, required recall, step count, destructive consequence); others such as expertise or confusion are uncertain observations and must remain advisory.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| measurable_burden_separated_from_inference | invariant | Objective interaction attributes are stored separately from inferred user-state attributes; inferred expertise, confusion, fatigue, or cognitive burden are labeled uncertain and cannot alone trigger protected actions. | [[cognitive.ergonomics]] |
| recognition_preferred_when_equivalent | invariant | When semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state. | [[cognitive.ergonomics]] |
| interruption_has_value_test | invariant | Proactive interruption is eligible only when the policy records the unresolved need, expected benefit, urgency, and why deferral is insufficient. | [[cognitive.ergonomics]] |
| choice_complexity_bounded | invariant | Large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface. | [[cognitive.ergonomics]] |
| adaptation_temporally_stable | invariant | An active interaction is not replaced, reordered, or semantically remapped while the user is entering a response unless required for safety or explicitly accepted by the user. | [[cognitive.ergonomics]] |
| stable_action_identity | invariant | Frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs. | [[cognitive.ergonomics]] |
| adaptation_explainable_and_overridable | invariant | Material adaptive changes expose a reason and, where safety permits, a way to revert, disable, or choose a stable presentation. | [[cognitive.ergonomics]] |
| uncertainty_not_fabricated | invariant | The system communicates material uncertainty supported by evidence but does not invent calibrated probabilities or force one visualization technique across domains/modalities. | [[cognitive.ergonomics]] |

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
| propose_adaptation | baseline | candidate_adaptation | [[cognitive.ergonomics.measurable_burden_separated_from_inference]] |
| admit_stable_adaptation | candidate_adaptation | eligible | [[cognitive.ergonomics.adaptation_temporally_stable]] |
| block_disruptive_adaptation | candidate_adaptation | blocked | ¬([[cognitive.ergonomics.adaptation_temporally_stable]]) |
| apply_adaptation | eligible | applied | [[cognitive.ergonomics.adaptation_explainable_and_overridable]] |
| defer_interruption | eligible | deferred | ¬([[cognitive.ergonomics.interruption_has_value_test]]) |
| revert_adaptation | applied | reverted | [[cognitive.ergonomics.adaptation_explainable_and_overridable]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| active_control_not_replaced_mid_input | unit | [[cognitive.ergonomics.adaptation_temporally_stable]] | `any::<String>()` | `Interaction test: non-safety adaptation cannot replace or reorder the active response surface during entry` |
| inferred_confusion_cannot_authorize | unit | [[cognitive.ergonomics.measurable_burden_separated_from_inference]] | `any::<String>()` | `Policy test: inferred human state never satisfies an authority guard` |
| interruption_requires_reason | unit | [[cognitive.ergonomics.interruption_has_value_test]] | `any::<String>()` | `Policy test: proactive interrupt without need/benefit/urgency/deferral rationale is ineligible` |
| uncertainty_requires_evidence | unit | [[cognitive.ergonomics.uncertainty_not_fabricated]] | `any::<String>()` | `TypeScript test: UI cannot render a numeric confidence absent a source declaring that metric and semantics` |
| p_recognition_preferred_when_equivalent | unit | [[cognitive.ergonomics.recognition_preferred_when_equivalent]] | `arbitrary_state()` | `when semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state` |
| p_choice_complexity_bounded | unit | [[cognitive.ergonomics.choice_complexity_bounded]] | `arbitrary_state()` | `large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface` |
| p_stable_action_identity | unit | [[cognitive.ergonomics.stable_action_identity]] | `arbitrary_state()` | `frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs` |
| p_adaptation_explainable_and_overridable | unit | [[cognitive.ergonomics.adaptation_explainable_and_overridable]] | `arbitrary_state()` | `material adaptive changes expose a reason and, where safety permits, a way to revert, disable, or choose a stable presentation` |
