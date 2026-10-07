---
id: spec
kind: intent
statement: THE Interaction Engine Conformance Suite SHALL detect behavioral drift across the core and every supported host adapter using shared contract scenarios
---

# Conformance and Regression Tests

Specodelic owns the specification structure and abstract lifecycle. The TypeScript test runner owns verification of the TypeScript implementation. Each Property ID in the feature specs must map to one or more stable TypeScript test IDs or scenario files; a passing Specodelic lint is not implementation conformance.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| every_property_mapped_to_test | invariant | Every Property ID in a feature spec maps to at least one test ID or scenario fixture in the TypeScript conformance manifest. | [[spec]] |
| cross_host_semantics_checked | invariant | Shared scenario fixtures run against each supported adapter and compare normalized event semantics, not pixel or layout identity. | [[spec]] |
| edge_cases_covered | invariant | The regression suite covers invalid context/contract, zero eligible candidates, deterministic ties, stale and duplicate events, concurrent submissions, cancellation, version skew, unsupported capabilities, host loss, and persistence faults. | [[spec]] |
| replay_fixtures_versioned | invariant | Every replay fixture records schema, catalog, policy and fixture versions plus initial state and ordered input events. | [[spec]] |
| security_fixtures_run_in_ci | invariant | Hostile payload, forged event, authorization bypass, resource-limit and diagnostic-leak scenarios run in CI for each supported adapter. | [[spec]] |
| test_outcomes_reproducible | invariant | A failing scenario emits its test ID, input fixture ID, policy/catalog/schema versions, expected outcome, actual outcome and minimized reproduction where supported. | [[spec]] |
| quality_metrics_have_baseline | invariant | Before release claims, the team records baseline and advisor-guided results on the same task scenarios for completion time, corrections, redundant/invalid interactions, abandonment and user understanding. | [[spec]] |
| no_claim_without_evidence | invariant | A release is not labelled lint-clean, model-checked, verified, portable or secure unless its recorded gate results support that exact claim. | [[spec]] |
| suite_manifest_complete | invariant | The conformance manifest contains all mapped properties, required edge/security scenarios, versioned replay fixtures, and declared adapter targets before a run begins. | [[spec]] |
| test_suite_passed | invariant | The conformance run passes only when every mandatory scenario for every declared target passes; skipped or unavailable targets are reported as incomplete, not as passed. | [[spec]] |
| fix_committed | invariant | A failed conformance run returns to mapped only after the relevant fix and regression scenario are committed to the suite. | [[spec]] |
| new_release_candidate | invariant | A passed suite returns to an unmapped release state only when a new code/spec/policy/catalog revision is submitted for evaluation. | [[spec]] |

| conformance_classes_distinct | invariant | Conformance distinguishes formal/schema-state tests, automated interaction/accessibility tests, and empirical human usability evaluation; passing one class cannot claim the others. | [[spec]] |
| empirical_claims_not_auto_verified | invariant | Learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named. | [[spec]] |
| research_acceptance_not_claimed_complete | invariant | Specification acceptance criteria are marked planned/unverified until corresponding implementation and evidence exist. | [[spec]] |

## Model
### States
- `unmapped`
- `mapped`
- `running`
- `passed`
- `failed`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| map_property_tests | unmapped | mapped | [[spec.every_property_mapped_to_test]] |
| begin_test_run | mapped | running | [[spec.suite_manifest_complete]] |
| accept_test_run | running | passed | [[spec.test_suite_passed]] |
| reject_test_run | running | failed | ¬([[spec.test_suite_passed]]) |
| rerun_after_correction | failed | mapped | [[spec.fix_committed]] |
| prepare_next_release | passed | unmapped | [[spec.new_release_candidate]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| properties_have_test_mapping | unit | [[spec.every_property_mapped_to_test]] | `any::<String>()` | `TypeScript CI test: every feature-spec Property ID resolves to at least one existing named test` |
| adapter_semantics_match | unit | [[spec.cross_host_semantics_checked]] | `any::<String>()` | `TypeScript CI test: semantically equivalent web/TUI answers reduce to equivalent core events and outcomes` |
| mandatory_edge_matrix_runs | unit | [[spec.edge_cases_covered]] | `any::<String>()` | `TypeScript CI test: each required edge-case category has at least one passing and one applicable negative fixture` |
| replay_is_versioned | unit | [[spec.replay_fixtures_versioned]] | `any::<String>()` | `TypeScript CI test: replay fixture without required version/initial-state fields is rejected` |
| security_matrix_runs_in_ci | unit | [[spec.security_fixtures_run_in_ci]] | `any::<String>()` | `CI configuration test: security scenario groups run for each declared adapter target` |
| failure_is_reproducible | unit | [[spec.test_outcomes_reproducible]] | `any::<String>()` | `TypeScript CI test: failure report records stable scenario/test identity and the pinned versions needed for reproduction` |
| quality_claims_have_measured_baseline | unit | [[spec.quality_metrics_have_baseline]] | `any::<String>()` | `Release gate test: performance/usability claims require baseline and advisor-guided measurements over the same scenario set` |
| unsupported_quality_claim_is_blocked | unit | [[spec.no_claim_without_evidence]] | `any::<String>()` | `Release gate test: absent lint/model-check/test evidence prevents the corresponding quality claim` |
| suite_cannot_start_with_incomplete_manifest | unit | [[spec.suite_manifest_complete]] | `any::<String>()` | `TypeScript CI test: a missing mapped property, edge/security scenario, replay version or adapter target blocks a passing result` |
| all_mandatory_targets_must_pass | unit | [[spec.test_suite_passed]] | `any::<String>()` | `TypeScript CI test: one failed/skipped mandatory scenario or target prevents the suite from entering passed` |
| failed_run_requires_committed_fix | unit | [[spec.fix_committed]] | `any::<String>()` | `TypeScript CI test: retry after failure requires a committed fix and retained regression case` |
| new_revision_requires_new_run | unit | [[spec.new_release_candidate]] | `any::<String>()` | `Release gate test: a changed code/spec/policy/catalog revision cannot inherit the prior revision's pass status` |
| machine_tests_do_not_claim_usability | unit | [[spec.conformance_classes_distinct]] | `any::<String>()` | `Documentation test: automated pass status cannot set empirical usability status to passed` |
| planned_tests_remain_unverified | unit | [[spec.research_acceptance_not_claimed_complete]] | `any::<String>()` | `Provenance test: absent evidence keeps acceptance status planned/unverified` |
| p_empirical_claims_not_auto_verified | unit | [[spec.empirical_claims_not_auto_verified]] | `arbitrary_state()` | `learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named` |

## Requirements

### Requirement: Conformance and Regression Tests declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Conformance and Regression Tests invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.properties_have_test_mapping]]
- **VERIFIES** [[spec.adapter_semantics_match]]
- **VERIFIES** [[spec.mandatory_edge_matrix_runs]]
- **VERIFIES** [[spec.replay_is_versioned]]
- **VERIFIES** [[spec.security_matrix_runs_in_ci]]
- **VERIFIES** [[spec.failure_is_reproducible]]
- **VERIFIES** [[spec.quality_claims_have_measured_baseline]]
- **VERIFIES** [[spec.unsupported_quality_claim_is_blocked]]
- **VERIFIES** [[spec.suite_cannot_start_with_incomplete_manifest]]
- **VERIFIES** [[spec.all_mandatory_targets_must_pass]]
- **VERIFIES** [[spec.failed_run_requires_committed_fix]]
- **VERIFIES** [[spec.new_revision_requires_new_run]]
- **VERIFIES** [[spec.machine_tests_do_not_claim_usability]]
- **VERIFIES** [[spec.planned_tests_remain_unverified]]
- **VERIFIES** [[spec.p_empirical_claims_not_auto_verified]]

#### Scenario: Violating a Conformance and Regression Tests invariant is rejected

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
