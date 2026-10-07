---
id: spec
kind: intent
statement: WHEN execution or interaction deviates from expected behavior, THE Failure Model SHALL represent the failure scope, effect certainty, recoverability, and evidence before recovery is selected
---

# Failure Model

Failure is ordinary runtime state. A timeout, malformed AI proposal, inaccessible interaction, stale revision, partial transaction, conflicting edit, or user mistake must be represented explicitly rather than collapsed into a generic error.

A particularly important distinction is between a known failed effect and an **unknown outcome**. Loss of acknowledgement does not prove that an external side effect did not occur.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| failure_is_typed | invariant | Every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence. | [[spec]] |
| effect_certainty_explicit | invariant | For operations that may have external effects, failure records distinguish `no_effect`, `effect_applied`, `partial_effect`, and `effect_unknown`; timeout or transport failure alone cannot imply `no_effect`. | [[spec]] |
| recoverability_explicit | invariant | Failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown. | [[spec]] |
| retry_safety_explicit | invariant | A failure involving a mutating operation records whether retry is proven idempotent, requires reconciliation, or is prohibited until effect state is known. | [[spec]] |
| user_work_preserved_when_possible | invariant | Failure containment preserves validated user input, drafts, evidence, and audit history unless preservation would violate security or privacy policy. | [[spec]] |
| failure_diagnostic_non_deceptive | invariant | User-facing failure status distinguishes what is known, what failed, what may have succeeded, and what remains uncertain. | [[spec]] |
| ai_failure_contained | invariant | Malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded. | [[spec]] |
| failure_provenance_retained | invariant | Failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references. | [[spec]] |

## Model
### States
- `detected`
- `contained`
- `assessing`
- `known`
- `uncertain`
- `resolved`
- `escalated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| contain_failure | detected | contained | [[spec.failure_is_typed]] |
| assess_failure | contained | assessing | [[spec.effect_certainty_explicit]] |
| classify_known_failure | assessing | known | [[spec.effect_certainty_explicit]] |
| classify_uncertain_failure | assessing | uncertain | [[spec.effect_certainty_explicit]] |
| resolve_known_failure | known | resolved | [[spec.recoverability_explicit]] |
| escalate_uncertain_failure | uncertain | escalated | ¬([[spec.retry_safety_explicit]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| timeout_never_implies_no_effect | unit | [[spec.effect_certainty_explicit]] | `any::<String>()` | `Fault-injection test: lost acknowledgement after a mutating request yields effect_unknown until reconciliation supplies evidence` |
| unsafe_retry_blocked | unit | [[spec.retry_safety_explicit]] | `any::<String>()` | `TypeScript test: non-idempotent unknown-effect failure cannot enter retry path` |
| preserved_draft_survives_failure | unit | [[spec.user_work_preserved_when_possible]] | `any::<String>()` | `Recovery test: recoverable infrastructure failure retains validated draft data` |
| uncertainty_visible | unit | [[spec.failure_diagnostic_non_deceptive]] | `any::<String>()` | `UX contract test: unknown effect state cannot render as definitely failed or definitely succeeded` |
| p_failure_is_typed | unit | [[spec.failure_is_typed]] | `arbitrary_state()` | `every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence` |
| p_recoverability_explicit | unit | [[spec.recoverability_explicit]] | `arbitrary_state()` | `failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown` |
| p_ai_failure_contained | unit | [[spec.ai_failure_contained]] | `arbitrary_state()` | `malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded` |
| p_failure_provenance_retained | unit | [[spec.failure_provenance_retained]] | `arbitrary_state()` | `failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references` |

## Requirements

### Requirement: Failure Model model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: contain-failure moves `detected` to `contained`
- **WHEN** the model is in the `detected` state and the `contain_failure` transition guard holds ([[spec.failure_is_typed]])
- **THEN** the model enters the `contained` state and records the transition
- **VERIFIES** [[spec.p_failure_is_typed]]

#### Scenario: assess-failure moves `contained` to `assessing`
- **WHEN** the model is in the `contained` state and the `assess_failure` transition guard holds ([[spec.effect_certainty_explicit]])
- **THEN** the model enters the `assessing` state and records the transition
- **VERIFIES** [[spec.timeout_never_implies_no_effect]]

#### Scenario: classify-known-failure moves `assessing` to `known`
- **WHEN** the model is in the `assessing` state and the `classify_known_failure` transition guard holds ([[spec.effect_certainty_explicit]])
- **THEN** the model enters the `known` state and records the transition
- **VERIFIES** [[spec.timeout_never_implies_no_effect]]

#### Scenario: classify-uncertain-failure moves `assessing` to `uncertain`
- **WHEN** the model is in the `assessing` state and the `classify_uncertain_failure` transition guard holds ([[spec.effect_certainty_explicit]])
- **THEN** the model enters the `uncertain` state and records the transition
- **VERIFIES** [[spec.timeout_never_implies_no_effect]]

#### Scenario: resolve-known-failure moves `known` to `resolved`
- **WHEN** the model is in the `known` state and the `resolve_known_failure` transition guard holds ([[spec.recoverability_explicit]])
- **THEN** the model enters the `resolved` state and records the transition
- **VERIFIES** [[spec.p_recoverability_explicit]]

#### Scenario: escalate-uncertain-failure moves `uncertain` to `escalated`
- **WHEN** the model is in the `uncertain` state and the `escalate_uncertain_failure` transition guard evaluates false (¬([[spec.retry_safety_explicit]]))
- **THEN** the model enters the `escalated` state and records the transition
- **VERIFIES** [[spec.unsafe_retry_blocked]]

#### Scenario: user-work-preserved-when-possible invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Failure containment preserves validated user input, drafts, evidence, and audit history unless preservation would violate security or privacy policy."
- **VERIFIES** [[spec.preserved_draft_survives_failure]]

#### Scenario: failure-diagnostic-non-deceptive invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "User-facing failure status distinguishes what is known, what failed, what may have succeeded, and what remains uncertain."
- **VERIFIES** [[spec.uncertainty_visible]]

#### Scenario: ai-failure-contained invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded."
- **VERIFIES** [[spec.p_ai_failure_contained]]

#### Scenario: failure-provenance-retained invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references."
- **VERIFIES** [[spec.p_failure_provenance_retained]]

#### Scenario: Violating Failure Model invariant is rejected

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
