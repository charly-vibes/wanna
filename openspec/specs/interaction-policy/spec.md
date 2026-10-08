---
id: interaction.policy
kind: intent
statement: THE Interaction Policy SHALL return eligible interaction recommendations in a deterministic order for a pinned context and catalog
---

# Interaction Policy

The policy selects among catalog-defined interaction kinds after the task has been normalized. LLM reasoning may identify the likely contribution needed; it is not the authority for eligibility, hard constraints, ordering, or permission to execute external work.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| policy_input_valid | invariant | Evaluation input contains a schema-valid normalized need and pinned task, policy, and catalog versions. | [[interaction.policy]] |
| candidates_checked_for_eligibility | invariant | Every candidate is checked for kind support, required input availability, catalog constraints, host capability requirements, and applicable hard policy gates before ranking. | [[interaction.policy]] |
| eligible_candidate_exists | invariant | A recommendation is returned only if at least one candidate passes every eligibility gate; otherwise the result is a distinct no-eligible-candidate outcome. | [[interaction.policy]] |
| deterministic_tie_breaking | invariant | Candidate ordering uses declared score fields and a stable final tie-break key independent of input array order, wall clock, randomness, or host iteration order. | [[interaction.policy]] |
| output_count_bounded | invariant | The recommendation count is between zero and the configured maximum; the maximum is validated as a positive bounded configuration value. | [[interaction.policy]] |
| exclusions_have_reason_codes | invariant | Every excluded candidate has at least one stable reason code tied to the gate that excluded it. | [[interaction.policy]] |
| policy_never_grants_authority | invariant | Policy results cannot authorize, approve, or execute a domain action; any independent permission or approval requirement remains mandatory. | [[interaction.policy]] |
| policy_version_is_observable | invariant | Every result records policy/catalog versions, normalized input identity, ranking keys, exclusion reasons, and the tie-break rule version. | [[interaction.policy]] |
| reevaluation_requested | invariant | A completed recommendation returns to evaluation only after an explicit reevaluation or changed-context request. | [[interaction.policy]] |
| new_context_received | invariant | A no-candidate result may be retried only after new context, catalog, or user preference data is supplied. | [[interaction.policy]] |
| corrected_input_received | invariant | A failed evaluation may be retried only after corrected, schema-valid context is supplied. | [[interaction.policy]] |

| policy_maps_need_to_semantics_before_ui | invariant | Policy first selects eligible contribution primitives/patterns for the normalized need, then presentation capabilities; host widgets are not ranking inputs to semantic selection. | [[interaction.policy]] |
| burden_inputs_typed | invariant | Policy distinguishes measurable burden attributes from uncertain inferred human-state attributes and records which influenced ranking. | [[interaction.policy]] |
| interruptions_require_justification | invariant | A proactive interruption is eligible only with an unresolved target, expected benefit, urgency/risk rationale, and reason deferral is insufficient. | [[interaction.policy]] |
| adaptation_stability_gate | invariant | Policy rejects non-safety adaptations that would replace or semantically remap an active interaction during response entry. | [[interaction.policy]] |

## Model
### States
- `ready`
- `evaluating`
- `recommended`
- `no_candidate`
- `failed`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| begin_valid_evaluation | ready | evaluating | [[interaction.policy.policy_input_valid]] |
| reject_invalid_input | ready | failed | ¬([[interaction.policy.policy_input_valid]]) |
| return_ranked_candidates | evaluating | recommended | [[interaction.policy.eligible_candidate_exists]] |
| return_no_candidate | evaluating | no_candidate | ¬([[interaction.policy.eligible_candidate_exists]]) |
| reevaluate_after_recommendation | recommended | ready | [[interaction.policy.reevaluation_requested]] |
| retry_after_empty_result | no_candidate | ready | [[interaction.policy.new_context_received]] |
| retry_after_failure | failed | ready | [[interaction.policy.corrected_input_received]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| ineligible_candidates_never_return | unit | [[interaction.policy.candidates_checked_for_eligibility]] | `any::<String>()` | `TypeScript test: no candidate failing any hard eligibility gate appears in recommendations` |
| no_candidate_is_explicit | unit | [[interaction.policy.eligible_candidate_exists]] | `any::<String>()` | `TypeScript test: zero eligible candidates returns the no-candidate result and does not invent an interaction` |
| deterministic_order_is_permutation_invariant | unit | [[interaction.policy.deterministic_tie_breaking]] | `any::<String>()` | `TypeScript test: permutations of the same candidate set return the same ordered recommendation IDs and reasons` |
| recommendation_count_is_bounded | unit | [[interaction.policy.output_count_bounded]] | `any::<String>()` | `TypeScript test: returned count never exceeds configured maximum and invalid maxima are rejected` |
| exclusions_are_explainable | unit | [[interaction.policy.exclusions_have_reason_codes]] | `any::<String>()` | `TypeScript test: every excluded candidate has a known non-empty reason code` |
| policy_cannot_authorize_action | unit | [[interaction.policy.policy_never_grants_authority]] | `any::<String>()` | `TypeScript test: a recommendation alone cannot satisfy an authorization/approval precondition` |
| policy_versions_are_recorded | unit | [[interaction.policy.policy_version_is_observable]] | `any::<String>()` | `TypeScript test: result contains the exact pinned policy/catalog/tie-break versions and ranking metadata` |
| malformed_policy_input_fails_closed | unit | [[interaction.policy.policy_input_valid]] | `any::<String>()` | `TypeScript test: malformed or version-incomplete input returns a typed failure and no recommendation` |
| recommendation_retries_only_on_request | unit | [[interaction.policy.reevaluation_requested]] | `any::<String>()` | `TypeScript test: recommendation is not reevaluated without an explicit request` |
| empty_result_requires_new_input | unit | [[interaction.policy.new_context_received]] | `any::<String>()` | `TypeScript test: unchanged context does not trigger an unbounded retry loop after no candidates are eligible` |
| failed_evaluation_requires_correction | unit | [[interaction.policy.corrected_input_received]] | `any::<String>()` | `TypeScript test: failed evaluation re-enters ready only after schema-valid corrected input` |
| need_maps_before_presentation | unit | [[interaction.policy.policy_maps_need_to_semantics_before_ui]] | `any::<String>()` | `Policy test: changing host component availability cannot silently change contribution semantics` |
| disruptive_mid_input_adaptation_blocked | unit | [[interaction.policy.adaptation_stability_gate]] | `any::<String>()` | `Interaction test: active response surface remains semantically stable` |
| p_burden_inputs_typed | unit | [[interaction.policy.burden_inputs_typed]] | `arbitrary_state()` | `policy distinguishes measurable burden attributes from uncertain inferred human-state attributes and records which influenced ranking` |
| p_interruptions_require_justification | unit | [[interaction.policy.interruptions_require_justification]] | `arbitrary_state()` | `a proactive interruption is eligible only with an unresolved target, expected benefit, urgency/risk rationale, and reason deferral is insufficient` |

## Requirements

### Requirement: Interaction Policy model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: begin-valid-evaluation moves `ready` to `evaluating`
- **WHEN** the model is in the `ready` state and the `begin_valid_evaluation` transition guard holds ([[interaction.policy.policy_input_valid]])
- **THEN** the model enters the `evaluating` state and records the transition
- **VERIFIES** [[interaction.policy.malformed_policy_input_fails_closed]]

#### Scenario: reject-invalid-input moves `ready` to `failed`
- **WHEN** the model is in the `ready` state and the `reject_invalid_input` transition guard evaluates false (¬([[interaction.policy.policy_input_valid]]))
- **THEN** the model enters the `failed` state and records the transition
- **VERIFIES** [[interaction.policy.malformed_policy_input_fails_closed]]

#### Scenario: return-ranked-candidates moves `evaluating` to `recommended`
- **WHEN** the model is in the `evaluating` state and the `return_ranked_candidates` transition guard holds ([[interaction.policy.eligible_candidate_exists]])
- **THEN** the model enters the `recommended` state and records the transition
- **VERIFIES** [[interaction.policy.no_candidate_is_explicit]]

#### Scenario: return-no-candidate moves `evaluating` to `no_candidate`
- **WHEN** the model is in the `evaluating` state and the `return_no_candidate` transition guard evaluates false (¬([[interaction.policy.eligible_candidate_exists]]))
- **THEN** the model enters the `no_candidate` state and records the transition
- **VERIFIES** [[interaction.policy.no_candidate_is_explicit]]

#### Scenario: reevaluate-after-recommendation moves `recommended` to `ready`
- **WHEN** the model is in the `recommended` state and the `reevaluate_after_recommendation` transition guard holds ([[interaction.policy.reevaluation_requested]])
- **THEN** the model enters the `ready` state and records the transition
- **VERIFIES** [[interaction.policy.recommendation_retries_only_on_request]]

#### Scenario: retry-after-empty-result moves `no_candidate` to `ready`
- **WHEN** the model is in the `no_candidate` state and the `retry_after_empty_result` transition guard holds ([[interaction.policy.new_context_received]])
- **THEN** the model enters the `ready` state and records the transition
- **VERIFIES** [[interaction.policy.empty_result_requires_new_input]]

#### Scenario: retry-after-failure moves `failed` to `ready`
- **WHEN** the model is in the `failed` state and the `retry_after_failure` transition guard holds ([[interaction.policy.corrected_input_received]])
- **THEN** the model enters the `ready` state and records the transition
- **VERIFIES** [[interaction.policy.failed_evaluation_requires_correction]]

#### Scenario: candidates-checked-for-eligibility invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every candidate is checked for kind support, required input availability, catalog constraints, host capability requirements, and applicable hard policy gates before ranking."
- **VERIFIES** [[interaction.policy.ineligible_candidates_never_return]]

#### Scenario: deterministic-tie-breaking invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Candidate ordering uses declared score fields and a stable final tie-break key independent of input array order, wall clock, randomness, or host iteration order."
- **VERIFIES** [[interaction.policy.deterministic_order_is_permutation_invariant]]

#### Scenario: output-count-bounded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The recommendation count is between zero and the configured maximum; the maximum is validated as a positive bounded configuration value."
- **VERIFIES** [[interaction.policy.recommendation_count_is_bounded]]

#### Scenario: exclusions-have-reason-codes invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every excluded candidate has at least one stable reason code tied to the gate that excluded it."
- **VERIFIES** [[interaction.policy.exclusions_are_explainable]]

#### Scenario: policy-never-grants-authority invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Policy results cannot authorize, approve, or execute a domain action; any independent permission or approval requirement remains mandatory."
- **VERIFIES** [[interaction.policy.policy_cannot_authorize_action]]

#### Scenario: policy-version-is-observable invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Every result records policy/catalog versions, normalized input identity, ranking keys, exclusion reasons, and the tie-break rule version."
- **VERIFIES** [[interaction.policy.policy_versions_are_recorded]]

#### Scenario: policy-maps-need-to-semantics-before-ui invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Policy first selects eligible contribution primitives/patterns for the normalized need, then presentation capabilities; host widgets are not ranking inputs to semantic selection."
- **VERIFIES** [[interaction.policy.need_maps_before_presentation]]

#### Scenario: burden-inputs-typed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Policy distinguishes measurable burden attributes from uncertain inferred human-state attributes and records which influenced ranking."
- **VERIFIES** [[interaction.policy.p_burden_inputs_typed]]

#### Scenario: interruptions-require-justification invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A proactive interruption is eligible only with an unresolved target, expected benefit, urgency/risk rationale, and reason deferral is insufficient."
- **VERIFIES** [[interaction.policy.p_interruptions_require_justification]]

#### Scenario: adaptation-stability-gate invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Policy rejects non-safety adaptations that would replace or semantically remap an active interaction during response entry."
- **VERIFIES** [[interaction.policy.disruptive_mid_input_adaptation_blocked]]

#### Scenario: Violating Interaction Policy invariant is rejected

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
