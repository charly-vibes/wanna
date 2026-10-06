---
id: interaction.patterns
kind: intent
statement: THE Interaction Pattern Layer SHALL compose contribution primitives into explicit reusable workflows without redefining primitive semantics
---

# Interaction Patterns

Interaction patterns represent recurring compound human activities. Examples include clarification, review, diagnosis, planning, monitoring, coordination, preference teaching, conflict resolution, and recovery assistance. Patterns are process compositions, not new widgets.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| patterns_compose_primitives | invariant | Every pattern identifies the contribution primitives it composes and the process edges connecting them. | [[interaction.patterns]] |
| pattern_completion_explicit | invariant | A pattern declares success, rejection, cancellation, deferral, failure, and unresolved completion conditions where applicable. | [[interaction.patterns]] |
| pattern_does_not_override_primitive | invariant | A pattern cannot change the response semantics, validation, authority meaning, or escape semantics of a referenced primitive. | [[interaction.patterns]] |
| pattern_state_host_neutral | invariant | Pattern progression is independent of DOM, Pi, TUI, component-library, and layout state. | [[interaction.patterns]] |
| review_separates_judgments | invariant | Review patterns distinguish inspection, evaluation, verification, annotation, rejection, and authorization rather than collapsing them into a generic approval event. | [[interaction.patterns]] |
| diagnosis_is_iterative_bounded | invariant | Diagnosis patterns explicitly model inspect, hypothesis/evaluation, evidence acquisition, correction proposal, and exit conditions; loops have bounded or externally interruptible termination. | [[interaction.patterns]] |
| clarification_reduces_unresolved_state | invariant | A clarification step is requested only when its expected response can reduce a represented ambiguity, missing fact, conflict, or decision uncertainty. | [[interaction.patterns]] |
| pattern_versioned | invariant | Pattern definitions and their primitive mappings carry explicit versions used in replay and audit. | [[interaction.patterns]] |

## Model
### States
- `draft`
- `validated`
- `running`
- `waiting`
- `completed`
- `unresolved`
- `cancelled`
- `failed`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_pattern | draft | validated | [[interaction.patterns.patterns_compose_primitives]] |
| start_pattern | validated | running | [[interaction.patterns.pattern_completion_explicit]] |
| wait_for_contribution | running | waiting | [[interaction.patterns.patterns_compose_primitives]] |
| resume_pattern | waiting | running | [[interaction.patterns.patterns_compose_primitives]] |
| complete_pattern | running | completed | [[interaction.patterns.pattern_completion_explicit]] |
| preserve_unresolved_pattern | running | unresolved | ¬([[interaction.patterns.pattern_completion_explicit]]) |
| cancel_pattern | running | cancelled | [[interaction.patterns.pattern_completion_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| every_pattern_step_is_semantic | unit | [[interaction.patterns.patterns_compose_primitives]] | `any::<String>()` | `Graph test: each human-contribution node references a registered primitive` |
| review_does_not_conflate_authority | unit | [[interaction.patterns.review_separates_judgments]] | `any::<String>()` | `TypeScript test: review can verify without authorizing and authorize only through a distinct event` |
| clarification_has_information_gain_target | unit | [[interaction.patterns.clarification_reduces_unresolved_state]] | `any::<String>()` | `Policy test: clarification without a named unresolved target is ineligible` |
| pattern_replay_is_versioned | unit | [[interaction.patterns.pattern_versioned]] | `any::<String>()` | `Replay test: historical pattern events resolve against the recorded pattern version` |
