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

### Requirement: Interaction Amplification Policy declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Interaction Amplification Policy invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.risk_floor_preserved_holds]]
- **VERIFIES** [[spec.least_burden_candidate_holds]]
- **VERIFIES** [[spec.no_interaction_when_not_needed_holds]]
- **VERIFIES** [[spec.uncertainty_can_escalate_holds]]
- **VERIFIES** [[spec.decision_reasons_stable_holds]]
- **VERIFIES** [[spec.preferences_are_soft_unless_declared_holds]]
- **VERIFIES** [[spec.deterministic_after_normalization_holds]]

#### Scenario: Violating a Interaction Amplification Policy invariant is rejected

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
