---
id: evaluation.telemetry
kind: intent
statement: THE Evaluation and Telemetry Layer SHALL measure interaction quality and implementation performance without confusing proxy metrics with correctness
---

# Evaluation, Telemetry, and Optimization

Telemetry informs improvement but does not itself authorize policy changes. Measurements may include completion rate, correction rate, time to useful answer, abandonment, review burden, accessibility fallback, latency, token/cost use, safety failures, and outcome quality. The system must retain the distinction between agreement with a previous model and independently established correctness.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| metrics_have_definitions | invariant | Every metric declares a name, unit, population, sampling method, missing-data behavior, and interpretation limits. | [[evaluation.telemetry]] |
| privacy_minimized | invariant | Telemetry collection applies purpose limitation, data minimization, access controls, and configured retention. | [[evaluation.telemetry]] |
| agreement_not_correctness | invariant | Agreement with an incumbent model or implementation is recorded as agreement, not as correctness ground truth. | [[evaluation.telemetry]] |
| promotion_requires_evidence | invariant | An optimized implementation is promoted only after declared quality, safety, cost, and latency gates pass for the relevant workload. | [[evaluation.telemetry]] |
| shadow_effects_suppressed | invariant | Shadow evaluation suppresses live effects or uses isolated test doubles. | [[evaluation.telemetry]] |
| metrics_versioned | invariant | Evaluation records identify candidate implementation, incumbent implementation, dataset/workload revision, evaluator version, and policy thresholds. | [[evaluation.telemetry]] |
| regression_triggers_fallback | invariant | A promoted implementation that breaches a configured safety or quality guard can be disabled or rolled back according to an explicit recovery policy. | [[evaluation.telemetry]] |

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
| evaluate_candidate | collecting | evaluated | [[evaluation.telemetry.metrics_have_definitions]] |
| mark_eligible | evaluated | eligible | [[evaluation.telemetry.promotion_requires_evidence]] |
| promote_candidate | eligible | promoted | [[evaluation.telemetry.metrics_versioned]] |
| detect_degradation | promoted | degraded | [[evaluation.telemetry.regression_triggers_fallback]] |
| rollback_candidate | degraded | rolled_back | [[evaluation.telemetry.regression_triggers_fallback]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| metrics_have_definitions_holds | unit | [[evaluation.telemetry.metrics_have_definitions]] | `any::<String>()` | `TypeScript conformance test: assert invariant metrics_have_definitions at its trust boundary and under its stated edge cases.` |
| privacy_minimized_holds | unit | [[evaluation.telemetry.privacy_minimized]] | `any::<String>()` | `TypeScript conformance test: assert invariant privacy_minimized at its trust boundary and under its stated edge cases.` |
| agreement_not_correctness_holds | unit | [[evaluation.telemetry.agreement_not_correctness]] | `any::<String>()` | `TypeScript conformance test: assert invariant agreement_not_correctness at its trust boundary and under its stated edge cases.` |
| promotion_requires_evidence_holds | unit | [[evaluation.telemetry.promotion_requires_evidence]] | `any::<String>()` | `TypeScript conformance test: assert invariant promotion_requires_evidence at its trust boundary and under its stated edge cases.` |
| shadow_effects_suppressed_holds | unit | [[evaluation.telemetry.shadow_effects_suppressed]] | `any::<String>()` | `TypeScript conformance test: assert invariant shadow_effects_suppressed at its trust boundary and under its stated edge cases.` |
| metrics_versioned_holds | unit | [[evaluation.telemetry.metrics_versioned]] | `any::<String>()` | `TypeScript conformance test: assert invariant metrics_versioned at its trust boundary and under its stated edge cases.` |
| regression_triggers_fallback_holds | unit | [[evaluation.telemetry.regression_triggers_fallback]] | `any::<String>()` | `TypeScript conformance test: assert invariant regression_triggers_fallback at its trust boundary and under its stated edge cases.` |
