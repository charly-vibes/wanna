---
id: spec
kind: intent
statement: THE Capability Contract Layer SHALL describe reusable operations with explicit typed interfaces, effects, preconditions, postconditions, and evaluation criteria
---

# Reusable Capability Contract

A capability is a reusable operation the agent can invoke after it has been registered. The contract separates what the operation promises from how it is implemented. It is compatible with both deterministic functions and LLM-backed implementations, but implementation selection and invocation policy remain explicit. Model-generated capability proposals are untrusted until validated and committed.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| capability_identity_versioned | invariant | Every capability has a stable ID, semantic version, owner or provenance, and immutable revision identifier. | [[spec]] |
| inputs_outputs_typed | invariant | Every capability declares input and output schemas, validation rules, and error result types. | [[spec]] |
| pre_postconditions_declared | invariant | Every capability declares applicable preconditions, postconditions, and a typed result for unmet conditions. | [[spec]] |
| effects_declared | invariant | Every capability declares possible effects, resource requirements, idempotency behavior, and whether effects are reversible or compensatable. | [[spec]] |
| evaluation_contract_declared | invariant | Every capability declares goal checks and safety invariants separately, with the behavior required when either check fails. | [[spec]] |
| implementation_not_contract | invariant | Implementation code or provider-specific prompts are not treated as the public capability contract. | [[spec]] |
| compatibility_explicit | invariant | A capability revision that changes input/output or effect semantics requires an explicit compatibility decision and migration strategy. | [[spec]] |

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
| validate_capability | proposed | validated | [[spec.inputs_outputs_typed]] |
| reject_capability | proposed | rejected | ¬([[spec.inputs_outputs_typed]]) |
| register_capability | validated | registered | [[spec.evaluation_contract_declared]] |
| deprecate_capability | registered | deprecated | [[spec.compatibility_explicit]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| capability_identity_versioned_holds | unit | [[spec.capability_identity_versioned]] | `any::<String>()` | `TypeScript conformance test: assert invariant capability_identity_versioned at its trust boundary and under its stated edge cases.` |
| inputs_outputs_typed_holds | unit | [[spec.inputs_outputs_typed]] | `any::<String>()` | `TypeScript conformance test: assert invariant inputs_outputs_typed at its trust boundary and under its stated edge cases.` |
| pre_postconditions_declared_holds | unit | [[spec.pre_postconditions_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant pre_postconditions_declared at its trust boundary and under its stated edge cases.` |
| effects_declared_holds | unit | [[spec.effects_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant effects_declared at its trust boundary and under its stated edge cases.` |
| evaluation_contract_declared_holds | unit | [[spec.evaluation_contract_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant evaluation_contract_declared at its trust boundary and under its stated edge cases.` |
| implementation_not_contract_holds | unit | [[spec.implementation_not_contract]] | `any::<String>()` | `TypeScript conformance test: assert invariant implementation_not_contract at its trust boundary and under its stated edge cases.` |
| compatibility_explicit_holds | unit | [[spec.compatibility_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant compatibility_explicit at its trust boundary and under its stated edge cases.` |

## Requirements

### Requirement: Reusable Capability Contract declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Reusable Capability Contract invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.capability_identity_versioned_holds]]
- **VERIFIES** [[spec.inputs_outputs_typed_holds]]
- **VERIFIES** [[spec.pre_postconditions_declared_holds]]
- **VERIFIES** [[spec.effects_declared_holds]]
- **VERIFIES** [[spec.evaluation_contract_declared_holds]]
- **VERIFIES** [[spec.implementation_not_contract_holds]]
- **VERIFIES** [[spec.compatibility_explicit_holds]]

#### Scenario: Violating a Reusable Capability Contract invariant is rejected

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
