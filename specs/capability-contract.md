---
id: capability.contract
kind: intent
statement: THE Capability Contract Layer SHALL describe reusable operations with explicit typed interfaces, effects, preconditions, postconditions, and evaluation criteria
---

# Reusable Capability Contract

A capability is a reusable operation the agent can invoke after it has been registered. The contract separates what the operation promises from how it is implemented. It is compatible with both deterministic functions and LLM-backed implementations, but implementation selection and invocation policy remain explicit. Model-generated capability proposals are untrusted until validated and committed.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| capability_identity_versioned | invariant | Every capability has a stable ID, semantic version, owner or provenance, and immutable revision identifier. | [[capability.contract]] |
| inputs_outputs_typed | invariant | Every capability declares input and output schemas, validation rules, and error result types. | [[capability.contract]] |
| pre_postconditions_declared | invariant | Every capability declares applicable preconditions, postconditions, and a typed result for unmet conditions. | [[capability.contract]] |
| effects_declared | invariant | Every capability declares possible effects, resource requirements, idempotency behavior, and whether effects are reversible or compensatable. | [[capability.contract]] |
| evaluation_contract_declared | invariant | Every capability declares goal checks and safety invariants separately, with the behavior required when either check fails. | [[capability.contract]] |
| implementation_not_contract | invariant | Implementation code or provider-specific prompts are not treated as the public capability contract. | [[capability.contract]] |
| compatibility_explicit | invariant | A capability revision that changes input/output or effect semantics requires an explicit compatibility decision and migration strategy. | [[capability.contract]] |

## Model
### States
- `proposed`
- `validated`
- `registered`
- `deprecated`
- `rejected`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_capability | proposed | validated | [[capability.contract.inputs_outputs_typed]] |
| reject_capability | proposed | rejected | ¬([[capability.contract.inputs_outputs_typed]]) |
| register_capability | validated | registered | [[capability.contract.evaluation_contract_declared]] |
| deprecate_capability | registered | deprecated | [[capability.contract.compatibility_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| capability_identity_versioned_holds | unit | [[capability.contract.capability_identity_versioned]] | `any::<String>()` | `TypeScript conformance test: assert invariant capability_identity_versioned at its trust boundary and under its stated edge cases.` |
| inputs_outputs_typed_holds | unit | [[capability.contract.inputs_outputs_typed]] | `any::<String>()` | `TypeScript conformance test: assert invariant inputs_outputs_typed at its trust boundary and under its stated edge cases.` |
| pre_postconditions_declared_holds | unit | [[capability.contract.pre_postconditions_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant pre_postconditions_declared at its trust boundary and under its stated edge cases.` |
| effects_declared_holds | unit | [[capability.contract.effects_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant effects_declared at its trust boundary and under its stated edge cases.` |
| evaluation_contract_declared_holds | unit | [[capability.contract.evaluation_contract_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant evaluation_contract_declared at its trust boundary and under its stated edge cases.` |
| implementation_not_contract_holds | unit | [[capability.contract.implementation_not_contract]] | `any::<String>()` | `TypeScript conformance test: assert invariant implementation_not_contract at its trust boundary and under its stated edge cases.` |
| compatibility_explicit_holds | unit | [[capability.contract.compatibility_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant compatibility_explicit at its trust boundary and under its stated edge cases.` |
