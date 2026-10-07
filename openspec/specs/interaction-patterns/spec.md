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

### Requirement: Interaction Patterns declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction Patterns invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.every_pattern_step_is_semantic]]
- **VERIFIES** [[spec.review_does_not_conflate_authority]]
- **VERIFIES** [[spec.clarification_has_information_gain_target]]
- **VERIFIES** [[spec.pattern_replay_is_versioned]]
- **VERIFIES** [[spec.p_pattern_completion_explicit]]
- **VERIFIES** [[spec.p_pattern_does_not_override_primitive]]
- **VERIFIES** [[spec.p_pattern_state_host_neutral]]
- **VERIFIES** [[spec.p_diagnosis_is_iterative_bounded]]
- **VERIFIES** [[spec.p_pattern_failure_recorded]]

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
