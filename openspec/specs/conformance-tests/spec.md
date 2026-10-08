---
id: conformance.tests
kind: intent
statement: THE Interaction Engine Conformance Suite SHALL detect behavioral drift across the core and every supported host adapter using shared contract scenarios
---

# Conformance and Regression Tests

Specodelic owns the specification structure and abstract lifecycle. The TypeScript test runner owns verification of the TypeScript implementation. Each Property ID in the feature specs must map to one or more stable TypeScript test IDs or scenario files; a passing Specodelic lint is not implementation conformance.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| every_property_mapped_to_test | invariant | Every Property ID in a feature spec maps to at least one test ID or scenario fixture in the TypeScript conformance manifest. | [[conformance.tests]] |
| cross_host_semantics_checked | invariant | Shared scenario fixtures run against each supported adapter and compare normalized event semantics, not pixel or layout identity. | [[conformance.tests]] |
| edge_cases_covered | invariant | The regression suite covers invalid context/contract, zero eligible candidates, deterministic ties, stale and duplicate events, concurrent submissions, cancellation, version skew, unsupported capabilities, host loss, and persistence faults. | [[conformance.tests]] |
| replay_fixtures_versioned | invariant | Every replay fixture records schema, catalog, policy and fixture versions plus initial state and ordered input events. | [[conformance.tests]] |
| security_fixtures_run_in_ci | invariant | Hostile payload, forged event, authorization bypass, resource-limit and diagnostic-leak scenarios run in CI for each supported adapter. | [[conformance.tests]] |
| test_outcomes_reproducible | invariant | A failing scenario emits its test ID, input fixture ID, policy/catalog/schema versions, expected outcome, actual outcome and minimized reproduction where supported. | [[conformance.tests]] |
| quality_metrics_have_baseline | invariant | Before release claims, the team records baseline and advisor-guided results on the same task scenarios for completion time, corrections, redundant/invalid interactions, abandonment and user understanding. | [[conformance.tests]] |
| no_claim_without_evidence | invariant | A release is not labelled lint-clean, model-checked, verified, portable or secure unless its recorded gate results support that exact claim. | [[conformance.tests]] |
| suite_manifest_complete | invariant | The conformance manifest contains all mapped properties, required edge/security scenarios, versioned replay fixtures, and declared adapter targets before a run begins. | [[conformance.tests]] |
| test_suite_passed | invariant | The conformance run passes only when every mandatory scenario for every declared target passes; skipped or unavailable targets are reported as incomplete, not as passed. | [[conformance.tests]] |
| fix_committed | invariant | A failed conformance run returns to mapped only after the relevant fix and regression scenario are committed to the suite. | [[conformance.tests]] |
| new_release_candidate | invariant | A passed suite returns to an unmapped release state only when a new code/spec/policy/catalog revision is submitted for evaluation. | [[conformance.tests]] |

| conformance_classes_distinct | invariant | Conformance distinguishes formal/schema-state tests, automated interaction/accessibility tests, and empirical human usability evaluation; passing one class cannot claim the others. | [[conformance.tests]] |
| empirical_claims_not_auto_verified | invariant | Learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named. | [[conformance.tests]] |
| research_acceptance_not_claimed_complete | invariant | Specification acceptance criteria are marked planned/unverified until corresponding implementation and evidence exist. | [[conformance.tests]] |

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
| map_property_tests | unmapped | mapped | [[conformance.tests.every_property_mapped_to_test]] |
| begin_test_run | mapped | running | [[conformance.tests.suite_manifest_complete]] |
| accept_test_run | running | passed | [[conformance.tests.test_suite_passed]] |
| reject_test_run | running | failed | ¬([[conformance.tests.test_suite_passed]]) |
| rerun_after_correction | failed | mapped | [[conformance.tests.fix_committed]] |
| prepare_next_release | passed | unmapped | [[conformance.tests.new_release_candidate]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| properties_have_test_mapping | unit | [[conformance.tests.every_property_mapped_to_test]] | `any::<String>()` | `TypeScript CI test: every feature-spec Property ID resolves to at least one existing named test` |
| adapter_semantics_match | unit | [[conformance.tests.cross_host_semantics_checked]] | `any::<String>()` | `TypeScript CI test: semantically equivalent web/TUI answers reduce to equivalent core events and outcomes` |
| mandatory_edge_matrix_runs | unit | [[conformance.tests.edge_cases_covered]] | `any::<String>()` | `TypeScript CI test: each required edge-case category has at least one passing and one applicable negative fixture` |
| replay_is_versioned | unit | [[conformance.tests.replay_fixtures_versioned]] | `any::<String>()` | `TypeScript CI test: replay fixture without required version/initial-state fields is rejected` |
| security_matrix_runs_in_ci | unit | [[conformance.tests.security_fixtures_run_in_ci]] | `any::<String>()` | `CI configuration test: security scenario groups run for each declared adapter target` |
| failure_is_reproducible | unit | [[conformance.tests.test_outcomes_reproducible]] | `any::<String>()` | `TypeScript CI test: failure report records stable scenario/test identity and the pinned versions needed for reproduction` |
| quality_claims_have_measured_baseline | unit | [[conformance.tests.quality_metrics_have_baseline]] | `any::<String>()` | `Release gate test: performance/usability claims require baseline and advisor-guided measurements over the same scenario set` |
| unsupported_quality_claim_is_blocked | unit | [[conformance.tests.no_claim_without_evidence]] | `any::<String>()` | `Release gate test: absent lint/model-check/test evidence prevents the corresponding quality claim` |
| suite_cannot_start_with_incomplete_manifest | unit | [[conformance.tests.suite_manifest_complete]] | `any::<String>()` | `TypeScript CI test: a missing mapped property, edge/security scenario, replay version or adapter target blocks a passing result` |
| all_mandatory_targets_must_pass | unit | [[conformance.tests.test_suite_passed]] | `any::<String>()` | `TypeScript CI test: one failed/skipped mandatory scenario or target prevents the suite from entering passed` |
| failed_run_requires_committed_fix | unit | [[conformance.tests.fix_committed]] | `any::<String>()` | `TypeScript CI test: retry after failure requires a committed fix and retained regression case` |
| new_revision_requires_new_run | unit | [[conformance.tests.new_release_candidate]] | `any::<String>()` | `Release gate test: a changed code/spec/policy/catalog revision cannot inherit the prior revision's pass status` |
| machine_tests_do_not_claim_usability | unit | [[conformance.tests.conformance_classes_distinct]] | `any::<String>()` | `Documentation test: automated pass status cannot set empirical usability status to passed` |
| planned_tests_remain_unverified | unit | [[conformance.tests.research_acceptance_not_claimed_complete]] | `any::<String>()` | `Provenance test: absent evidence keeps acceptance status planned/unverified` |
| p_empirical_claims_not_auto_verified | unit | [[conformance.tests.empirical_claims_not_auto_verified]] | `arbitrary_state()` | `learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named` |

## Requirements

### Requirement: Conformance and Regression Tests model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: map-property-tests moves `unmapped` to `mapped`
- **WHEN** the model is in the `unmapped` state and the `map_property_tests` transition guard holds ([[conformance.tests.every_property_mapped_to_test]])
- **THEN** the model enters the `mapped` state and records the transition
- **VERIFIES** [[conformance.tests.properties_have_test_mapping]]

#### Scenario: begin-test-run moves `mapped` to `running`
- **WHEN** the model is in the `mapped` state and the `begin_test_run` transition guard holds ([[conformance.tests.suite_manifest_complete]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[conformance.tests.suite_cannot_start_with_incomplete_manifest]]

#### Scenario: accept-test-run moves `running` to `passed`
- **WHEN** the model is in the `running` state and the `accept_test_run` transition guard holds ([[conformance.tests.test_suite_passed]])
- **THEN** the model enters the `passed` state and records the transition
- **VERIFIES** [[conformance.tests.all_mandatory_targets_must_pass]]

#### Scenario: reject-test-run moves `running` to `failed`
- **WHEN** the model is in the `running` state and the `reject_test_run` transition guard evaluates false (¬([[conformance.tests.test_suite_passed]]))
- **THEN** the model enters the `failed` state and records the transition
- **VERIFIES** [[conformance.tests.all_mandatory_targets_must_pass]]

#### Scenario: rerun-after-correction moves `failed` to `mapped`
- **WHEN** the model is in the `failed` state and the `rerun_after_correction` transition guard holds ([[conformance.tests.fix_committed]])
- **THEN** the model enters the `mapped` state and records the transition
- **VERIFIES** [[conformance.tests.failed_run_requires_committed_fix]]

#### Scenario: prepare-next-release moves `passed` to `unmapped`
- **WHEN** the model is in the `passed` state and the `prepare_next_release` transition guard holds ([[conformance.tests.new_release_candidate]])
- **THEN** the model enters the `unmapped` state and records the transition
- **VERIFIES** [[conformance.tests.new_revision_requires_new_run]]

#### Scenario: cross-host-semantics-checked invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Shared scenario fixtures run against each supported adapter and compare normalized event semantics, not pixel or layout identity."
- **VERIFIES** [[conformance.tests.adapter_semantics_match]]

#### Scenario: edge-cases-covered invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The regression suite covers invalid context/contract, zero eligible candidates, deterministic ties, stale and duplicate events, concurrent submissions, cancellation, version skew, unsupported capabilities, host loss, and persistence faults."
- **VERIFIES** [[conformance.tests.mandatory_edge_matrix_runs]]

#### Scenario: replay-fixtures-versioned invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every replay fixture records schema, catalog, policy and fixture versions plus initial state and ordered input events."
- **VERIFIES** [[conformance.tests.replay_is_versioned]]

#### Scenario: security-fixtures-run-in-ci invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Hostile payload, forged event, authorization bypass, resource-limit and diagnostic-leak scenarios run in CI for each supported adapter."
- **VERIFIES** [[conformance.tests.security_matrix_runs_in_ci]]

#### Scenario: test-outcomes-reproducible invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A failing scenario emits its test ID, input fixture ID, policy/catalog/schema versions, expected outcome, actual outcome and minimized reproduction where supported."
- **VERIFIES** [[conformance.tests.failure_is_reproducible]]

#### Scenario: quality-metrics-have-baseline invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Before release claims, the team records baseline and advisor-guided results on the same task scenarios for completion time, corrections, redundant/invalid interactions, abandonment and user understanding."
- **VERIFIES** [[conformance.tests.quality_claims_have_measured_baseline]]

#### Scenario: no-claim-without-evidence invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A release is not labelled lint-clean, model-checked, verified, portable or secure unless its recorded gate results support that exact claim."
- **VERIFIES** [[conformance.tests.unsupported_quality_claim_is_blocked]]

#### Scenario: conformance-classes-distinct invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Conformance distinguishes formal/schema-state tests, automated interaction/accessibility tests, and empirical human usability evaluation; passing one class cannot claim the others."
- **VERIFIES** [[conformance.tests.machine_tests_do_not_claim_usability]]

#### Scenario: empirical-claims-not-auto-verified invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Learnability, comprehension, perceived control, trust calibration, and similar human outcomes remain empirical properties requiring representative user evidence unless a narrower machine-verifiable proxy is explicitly named."
- **VERIFIES** [[conformance.tests.p_empirical_claims_not_auto_verified]]

#### Scenario: research-acceptance-not-claimed-complete invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Specification acceptance criteria are marked planned/unverified until corresponding implementation and evidence exist."
- **VERIFIES** [[conformance.tests.planned_tests_remain_unverified]]

#### Scenario: Violating Conformance and Regression Tests invariant is rejected

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
