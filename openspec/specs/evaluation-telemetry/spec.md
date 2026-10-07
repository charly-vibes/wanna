---
id: spec
kind: intent
statement: THE Evaluation and Telemetry Layer SHALL measure interaction quality and implementation performance without confusing proxy metrics with correctness
---

# Evaluation, Telemetry, and Optimization

Telemetry informs improvement but does not itself authorize policy changes. Measurements may include completion rate, correction rate, time to useful answer, abandonment, review burden, accessibility fallback, latency, token/cost use, safety failures, and outcome quality. The system must retain the distinction between agreement with a previous model and independently established correctness.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| metrics_have_definitions | invariant | Every metric declares a name, unit, population, sampling method, missing-data behavior, and interpretation limits. | [[spec]] |
| privacy_minimized | invariant | Telemetry collection applies purpose limitation, data minimization, access controls, and configured retention. | [[spec]] |
| agreement_not_correctness | invariant | Agreement with an incumbent model or implementation is recorded as agreement, not as correctness ground truth. | [[spec]] |
| promotion_requires_evidence | invariant | An optimized implementation is promoted only after declared quality, safety, cost, and latency gates pass for the relevant workload. | [[spec]] |
| shadow_effects_suppressed | invariant | Shadow evaluation suppresses live effects or uses isolated test doubles. | [[spec]] |
| metrics_versioned | invariant | Evaluation records identify candidate implementation, incumbent implementation, dataset/workload revision, evaluator version, and policy thresholds. | [[spec]] |
| regression_triggers_fallback | invariant | A promoted implementation that breaches a configured safety or quality guard can be disabled or rolled back according to an explicit recovery policy. | [[spec]] |

## Model
### States
- `collecting`
- `evaluated`
- `eligible`
- `promoted`
- `degraded`
- `rolled_back`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| evaluate_candidate | collecting | evaluated | [[spec.metrics_have_definitions]] |
| mark_eligible | evaluated | eligible | [[spec.promotion_requires_evidence]] |
| promote_candidate | eligible | promoted | [[spec.metrics_versioned]] |
| detect_degradation | promoted | degraded | [[spec.regression_triggers_fallback]] |
| rollback_candidate | degraded | rolled_back | [[spec.regression_triggers_fallback]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| metrics_have_definitions_holds | unit | [[spec.metrics_have_definitions]] | `any::<String>()` | `TypeScript conformance test: assert invariant metrics_have_definitions at its trust boundary and under its stated edge cases.` |
| privacy_minimized_holds | unit | [[spec.privacy_minimized]] | `any::<String>()` | `TypeScript conformance test: assert invariant privacy_minimized at its trust boundary and under its stated edge cases.` |
| agreement_not_correctness_holds | unit | [[spec.agreement_not_correctness]] | `any::<String>()` | `TypeScript conformance test: assert invariant agreement_not_correctness at its trust boundary and under its stated edge cases.` |
| promotion_requires_evidence_holds | unit | [[spec.promotion_requires_evidence]] | `any::<String>()` | `TypeScript conformance test: assert invariant promotion_requires_evidence at its trust boundary and under its stated edge cases.` |
| shadow_effects_suppressed_holds | unit | [[spec.shadow_effects_suppressed]] | `any::<String>()` | `TypeScript conformance test: assert invariant shadow_effects_suppressed at its trust boundary and under its stated edge cases.` |
| metrics_versioned_holds | unit | [[spec.metrics_versioned]] | `any::<String>()` | `TypeScript conformance test: assert invariant metrics_versioned at its trust boundary and under its stated edge cases.` |
| regression_triggers_fallback_holds | unit | [[spec.regression_triggers_fallback]] | `any::<String>()` | `TypeScript conformance test: assert invariant regression_triggers_fallback at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Evaluation, Telemetry, and Optimization model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: evaluate-candidate moves `collecting` to `evaluated`
- **WHEN** the model is in the `collecting` state and the `evaluate_candidate` transition guard holds ([[spec.metrics_have_definitions]])
- **THEN** the model enters the `evaluated` state and records the transition
- **VERIFIES** [[spec.metrics_have_definitions_holds]]

#### Scenario: mark-eligible moves `evaluated` to `eligible`
- **WHEN** the model is in the `evaluated` state and the `mark_eligible` transition guard holds ([[spec.promotion_requires_evidence]])
- **THEN** the model enters the `eligible` state and records the transition
- **VERIFIES** [[spec.promotion_requires_evidence_holds]]

#### Scenario: promote-candidate moves `eligible` to `promoted`
- **WHEN** the model is in the `eligible` state and the `promote_candidate` transition guard holds ([[spec.metrics_versioned]])
- **THEN** the model enters the `promoted` state and records the transition
- **VERIFIES** [[spec.metrics_versioned_holds]]

#### Scenario: detect-degradation moves `promoted` to `degraded`
- **WHEN** the model is in the `promoted` state and the `detect_degradation` transition guard holds ([[spec.regression_triggers_fallback]])
- **THEN** the model enters the `degraded` state and records the transition
- **VERIFIES** [[spec.regression_triggers_fallback_holds]]

#### Scenario: rollback-candidate moves `degraded` to `rolled_back`
- **WHEN** the model is in the `degraded` state and the `rollback_candidate` transition guard holds ([[spec.regression_triggers_fallback]])
- **THEN** the model enters the `rolled_back` state and records the transition
- **VERIFIES** [[spec.regression_triggers_fallback_holds]]

#### Scenario: privacy-minimized invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Telemetry collection applies purpose limitation, data minimization, access controls, and configured retention."
- **VERIFIES** [[spec.privacy_minimized_holds]]

#### Scenario: agreement-not-correctness invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Agreement with an incumbent model or implementation is recorded as agreement, not as correctness ground truth."
- **VERIFIES** [[spec.agreement_not_correctness_holds]]

#### Scenario: shadow-effects-suppressed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Shadow evaluation suppresses live effects or uses isolated test doubles."
- **VERIFIES** [[spec.shadow_effects_suppressed_holds]]

#### Scenario: Violating Evaluation, Telemetry, and Optimization invariant is rejected

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
