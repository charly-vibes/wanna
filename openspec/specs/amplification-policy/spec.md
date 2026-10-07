---
id: spec
kind: intent
statement: THE Amplification Policy SHALL choose the least burdensome eligible interaction that resolves the current human-contribution bottleneck without weakening required assurance
---

# Interaction Amplification Policy

Amplification means increasing the leverage of human input: collect several independent facts efficiently, expose meaningful alternatives, support direct correction, reveal evidence, or ask for authorization at the right time. It does not mean maximizing widgets, automation, interruption, or visual complexity.

The policy is deterministic after task state, normalized need, host capabilities, risk class, user preferences, and evidence have been normalized. An LLM may propose the need or candidate description; it cannot author or bypass the trusted ranking and eligibility rules.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| risk_floor_preserved | invariant | The selected interaction meets the assurance floor required by the action risk class even when a lower-friction option exists. | [[spec]] |
| least_burden_candidate | invariant | Among candidates that meet all hard constraints, policy prefers the candidate with the lowest declared expected human effort according to the pinned scoring policy. | [[spec]] |
| no_interaction_when_not_needed | invariant | Policy may return no interaction when no human contribution is required and no unresolved authority or verification gate remains. | [[spec]] |
| uncertainty_can_escalate | invariant | Uncertainty or conflicting evidence may increase the required review level but never silently decreases it. | [[spec]] |
| decision_reasons_stable | invariant | Every policy result contains stable reason codes for selected candidates and exclusions. | [[spec]] |
| preferences_are_soft_unless_declared | invariant | User presentation preferences affect ranking only unless an explicit accessibility, safety, or task constraint makes them mandatory. | [[spec]] |
| deterministic_after_normalization | invariant | Equal normalized context and pinned policy/catalog versions produce structurally equal ordered decisions. | [[spec]] |

## Model
### States
- `received`
- `normalized`
- `evaluated`
- `selected`
- `no_candidate`
- `stale`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| normalize_context | received | normalized | [[spec.deterministic_after_normalization]] |
| evaluate_candidates | normalized | evaluated | [[spec.risk_floor_preserved]] |
| select_candidate | evaluated | selected | [[spec.least_burden_candidate]] |
| return_no_candidate | evaluated | no_candidate | [[spec.no_interaction_when_not_needed]] |
| reject_stale_context | evaluated | stale | ¬([[spec.deterministic_after_normalization]]) |
| recompute_new_context | stale | received | [[spec.decision_reasons_stable]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| risk_floor_preserved_holds | unit | [[spec.risk_floor_preserved]] | `any::<String>()` | `TypeScript conformance test: assert invariant risk_floor_preserved at its trust boundary and under its stated edge cases.` |
| least_burden_candidate_holds | unit | [[spec.least_burden_candidate]] | `any::<String>()` | `TypeScript conformance test: assert invariant least_burden_candidate at its trust boundary and under its stated edge cases.` |
| no_interaction_when_not_needed_holds | unit | [[spec.no_interaction_when_not_needed]] | `any::<String>()` | `TypeScript conformance test: assert invariant no_interaction_when_not_needed at its trust boundary and under its stated edge cases.` |
| uncertainty_can_escalate_holds | unit | [[spec.uncertainty_can_escalate]] | `any::<String>()` | `TypeScript conformance test: assert invariant uncertainty_can_escalate at its trust boundary and under its stated edge cases.` |
| decision_reasons_stable_holds | unit | [[spec.decision_reasons_stable]] | `any::<String>()` | `TypeScript conformance test: assert invariant decision_reasons_stable at its trust boundary and under its stated edge cases.` |
| preferences_are_soft_unless_declared_holds | unit | [[spec.preferences_are_soft_unless_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant preferences_are_soft_unless_declared at its trust boundary and under its stated edge cases.` |
| deterministic_after_normalization_holds | unit | [[spec.deterministic_after_normalization]] | `any::<String>()` | `TypeScript conformance test: assert invariant deterministic_after_normalization at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Interaction Amplification Policy model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: normalize-context moves `received` to `normalized`
- **WHEN** the model is in the `received` state and the `normalize_context` transition guard holds ([[spec.deterministic_after_normalization]])
- **THEN** the model enters the `normalized` state and records the transition
- **VERIFIES** [[spec.deterministic_after_normalization_holds]]

#### Scenario: evaluate-candidates moves `normalized` to `evaluated`
- **WHEN** the model is in the `normalized` state and the `evaluate_candidates` transition guard holds ([[spec.risk_floor_preserved]])
- **THEN** the model enters the `evaluated` state and records the transition
- **VERIFIES** [[spec.risk_floor_preserved_holds]]

#### Scenario: select-candidate moves `evaluated` to `selected`
- **WHEN** the model is in the `evaluated` state and the `select_candidate` transition guard holds ([[spec.least_burden_candidate]])
- **THEN** the model enters the `selected` state and records the transition
- **VERIFIES** [[spec.least_burden_candidate_holds]]

#### Scenario: return-no-candidate moves `evaluated` to `no_candidate`
- **WHEN** the model is in the `evaluated` state and the `return_no_candidate` transition guard holds ([[spec.no_interaction_when_not_needed]])
- **THEN** the model enters the `no_candidate` state and records the transition
- **VERIFIES** [[spec.no_interaction_when_not_needed_holds]]

#### Scenario: reject-stale-context moves `evaluated` to `stale`
- **WHEN** the model is in the `evaluated` state and the `reject_stale_context` transition guard evaluates false (¬([[spec.deterministic_after_normalization]]))
- **THEN** the model enters the `stale` state and records the transition
- **VERIFIES** [[spec.deterministic_after_normalization_holds]]

#### Scenario: recompute-new-context moves `stale` to `received`
- **WHEN** the model is in the `stale` state and the `recompute_new_context` transition guard holds ([[spec.decision_reasons_stable]])
- **THEN** the model enters the `received` state and records the transition
- **VERIFIES** [[spec.decision_reasons_stable_holds]]

#### Scenario: uncertainty-can-escalate invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Uncertainty or conflicting evidence may increase the required review level but never silently decreases it."
- **VERIFIES** [[spec.uncertainty_can_escalate_holds]]

#### Scenario: preferences-are-soft-unless-declared invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "User presentation preferences affect ranking only unless an explicit accessibility, safety, or task constraint makes them mandatory."
- **VERIFIES** [[spec.preferences_are_soft_unless_declared_holds]]

#### Scenario: Violating Interaction Amplification Policy invariant is rejected

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
