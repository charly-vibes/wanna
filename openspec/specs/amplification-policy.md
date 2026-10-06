---
id: amplification.policy
kind: intent
statement: THE Amplification Policy SHALL choose the least burdensome eligible interaction that resolves the current human-contribution bottleneck without weakening required assurance
---

# Interaction Amplification Policy

Amplification means increasing the leverage of human input: collect several independent facts efficiently, expose meaningful alternatives, support direct correction, reveal evidence, or ask for authorization at the right time. It does not mean maximizing widgets, automation, interruption, or visual complexity.

The policy is deterministic after task state, normalized need, host capabilities, risk class, user preferences, and evidence have been normalized. An LLM may propose the need or candidate description; it cannot author or bypass the trusted ranking and eligibility rules.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| risk_floor_preserved | invariant | The selected interaction meets the assurance floor required by the action risk class even when a lower-friction option exists. | [[amplification.policy]] |
| least_burden_candidate | invariant | Among candidates that meet all hard constraints, policy prefers the candidate with the lowest declared expected human effort according to the pinned scoring policy. | [[amplification.policy]] |
| no_interaction_when_not_needed | invariant | Policy may return no interaction when no human contribution is required and no unresolved authority or verification gate remains. | [[amplification.policy]] |
| uncertainty_can_escalate | invariant | Uncertainty or conflicting evidence may increase the required review level but never silently decreases it. | [[amplification.policy]] |
| decision_reasons_stable | invariant | Every policy result contains stable reason codes for selected candidates and exclusions. | [[amplification.policy]] |
| preferences_are_soft_unless_declared | invariant | User presentation preferences affect ranking only unless an explicit accessibility, safety, or task constraint makes them mandatory. | [[amplification.policy]] |
| deterministic_after_normalization | invariant | Equal normalized context and pinned policy/catalog versions produce structurally equal ordered decisions. | [[amplification.policy]] |

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
| normalize_context | received | normalized | [[amplification.policy.deterministic_after_normalization]] |
| evaluate_candidates | normalized | evaluated | [[amplification.policy.risk_floor_preserved]] |
| select_candidate | evaluated | selected | [[amplification.policy.least_burden_candidate]] |
| return_no_candidate | evaluated | no_candidate | [[amplification.policy.no_interaction_when_not_needed]] |
| reject_stale_context | evaluated | stale | ¬([[amplification.policy.deterministic_after_normalization]]) |
| recompute_new_context | stale | received | [[amplification.policy.decision_reasons_stable]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| risk_floor_preserved_holds | unit | [[amplification.policy.risk_floor_preserved]] | `any::<String>()` | `TypeScript conformance test: assert invariant risk_floor_preserved at its trust boundary and under its stated edge cases.` |
| least_burden_candidate_holds | unit | [[amplification.policy.least_burden_candidate]] | `any::<String>()` | `TypeScript conformance test: assert invariant least_burden_candidate at its trust boundary and under its stated edge cases.` |
| no_interaction_when_not_needed_holds | unit | [[amplification.policy.no_interaction_when_not_needed]] | `any::<String>()` | `TypeScript conformance test: assert invariant no_interaction_when_not_needed at its trust boundary and under its stated edge cases.` |
| uncertainty_can_escalate_holds | unit | [[amplification.policy.uncertainty_can_escalate]] | `any::<String>()` | `TypeScript conformance test: assert invariant uncertainty_can_escalate at its trust boundary and under its stated edge cases.` |
| decision_reasons_stable_holds | unit | [[amplification.policy.decision_reasons_stable]] | `any::<String>()` | `TypeScript conformance test: assert invariant decision_reasons_stable at its trust boundary and under its stated edge cases.` |
| preferences_are_soft_unless_declared_holds | unit | [[amplification.policy.preferences_are_soft_unless_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant preferences_are_soft_unless_declared at its trust boundary and under its stated edge cases.` |
| deterministic_after_normalization_holds | unit | [[amplification.policy.deterministic_after_normalization]] | `any::<String>()` | `TypeScript conformance test: assert invariant deterministic_after_normalization at its trust boundary and under its stated edge cases.` |
