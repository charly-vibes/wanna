---
id: spec
kind: intent
statement: THE Effect Boundary SHALL prevent preview, shadow evaluation, and untrusted proposals from producing unauthorized external effects
---

# Execution and Effect Boundary

Pure decision logic and reducers return effect intents as data. A trusted executor performs approved effects through declared ports. Preview and shadow modes must isolate or suppress external effects, or use explicit test doubles, because executing two implementations against live systems can duplicate irreversible actions. Generated code is not considered sandboxed merely because it is validated as a string.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| core_returns_effect_intents | invariant | Core evaluation and reduction produce effect intents as data and do not perform I/O. | [[spec]] |
| effects_allowlisted | invariant | The executor runs only declared effect types through explicitly configured ports. | [[spec]] |
| preview_effects_isolated | invariant | Preview and shadow evaluation cannot produce live external effects unless an explicitly authorized safe test environment is selected. | [[spec]] |
| effect_authorization_checked | invariant | The executor checks the current principal, scope, risk class, approval record, and revision preconditions immediately before protected effects. | [[spec]] |
| idempotency_or_compensation_declared | invariant | Every effect declares idempotency behavior or a compensation/recovery strategy before execution. | [[spec]] |
| timeouts_and_budgets_enforced | invariant | Executions enforce declared time, resource, recursion, output-size, and retry budgets. | [[spec]] |
| untrusted_code_not_in_process | invariant | If executable model-generated code is supported, it runs behind a separately specified isolation boundary rather than in the trusted host process. | [[spec]] |
| partial_failure_reported | invariant | Partial external success is represented explicitly and is not reported as an atomic rollback unless compensation has actually succeeded. | [[spec]] |

| effect_outcome_can_be_unknown | invariant | Effect execution supports an explicit unknown outcome when acknowledgement is lost or evidence is insufficient; unknown is not coerced to success or failure. | [[spec]] |
| retry_requires_idempotency_or_reconciliation | invariant | A mutating effect is retryable after uncertain outcome only with a stable idempotency key/guarantee or successful reconciliation. | [[spec]] |
| effect_outcome_failure | effect | `effect.boundary.effect_execution_failure(detail) — a protected effect terminates without a verifiable outcome because detail; the failure is typed and evidenced, and the effect is not retried without satisfying retry_requires_idempotency_or_reconciliation` | [[spec]] |
| compensation_separate_effect | invariant | Compensation is modeled as a new effect with its own authority, failure, evidence, and verification rather than as rollback. | [[spec]] |

## Model
### States
- `proposed`
- `authorized`
- `running`
- `succeeded`
- `failed` (emits: `[[spec.effect_outcome_failure]]`)
- `partial`
- `cancelled`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| authorize_effect | proposed | authorized | [[spec.effect_authorization_checked]] |
| start_effect | authorized | running | [[spec.effects_allowlisted]] |
| complete_effect | running | succeeded | [[spec.idempotency_or_compensation_declared]] |
| fail_effect | running | failed | ¬([[spec.idempotency_or_compensation_declared]] ∨ [[spec.partial_failure_reported]]) |
| report_partial_effect | running | partial | [[spec.partial_failure_reported]] |
| cancel_effect | authorized | cancelled | [[spec.preview_effects_isolated]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| core_returns_effect_intents_holds | unit | [[spec.core_returns_effect_intents]] | `any::<String>()` | `TypeScript conformance test: assert invariant core_returns_effect_intents at its trust boundary and under its stated edge cases.` |
| effects_allowlisted_holds | unit | [[spec.effects_allowlisted]] | `any::<String>()` | `TypeScript conformance test: assert invariant effects_allowlisted at its trust boundary and under its stated edge cases.` |
| preview_effects_isolated_holds | unit | [[spec.preview_effects_isolated]] | `any::<String>()` | `TypeScript conformance test: assert invariant preview_effects_isolated at its trust boundary and under its stated edge cases.` |
| effect_authorization_checked_holds | unit | [[spec.effect_authorization_checked]] | `any::<String>()` | `TypeScript conformance test: assert invariant effect_authorization_checked at its trust boundary and under its stated edge cases.` |
| idempotency_or_compensation_declared_holds | unit | [[spec.idempotency_or_compensation_declared]] | `any::<String>()` | `TypeScript conformance test: assert invariant idempotency_or_compensation_declared at its trust boundary and under its stated edge cases.` |
| timeouts_and_budgets_enforced_holds | unit | [[spec.timeouts_and_budgets_enforced]] | `any::<String>()` | `TypeScript conformance test: assert invariant timeouts_and_budgets_enforced at its trust boundary and under its stated edge cases.` |
| untrusted_code_not_in_process_holds | unit | [[spec.untrusted_code_not_in_process]] | `any::<String>()` | `TypeScript conformance test: assert invariant untrusted_code_not_in_process at its trust boundary and under its stated edge cases.` |
| partial_failure_reported_holds | unit | [[spec.partial_failure_reported]] | `any::<String>()` | `TypeScript conformance test: assert invariant partial_failure_reported at its trust boundary and under its stated edge cases.` |
| unknown_effect_is_representable | unit | [[spec.effect_outcome_can_be_unknown]] | `any::<String>()` | `Fault-injection test: transport failure after send can produce unknown outcome` |
| compensation_can_fail_independently | unit | [[spec.compensation_separate_effect]] | `any::<String>()` | `Fault-injection test: failed compensation remains visible` |
| p_retry_requires_idempotency_or_reconciliation | unit | [[spec.retry_requires_idempotency_or_reconciliation]] | `arbitrary_state()` | `a mutating effect is retryable after uncertain outcome only with a stable idempotency key/guarantee or successful reconciliation` |
| p_effect_outcome_failure | unit | [[spec.effect_outcome_failure]] | `arbitrary_failed_effect()` | `failure is typed ∧ evidence retained ∧ no retry without idempotency or reconciliation` |

## Requirements

### Requirement: Execution and Effect Boundary model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: authorize-effect moves `proposed` to `authorized`
- **WHEN** the model is in the `proposed` state and the `authorize_effect` transition guard holds ([[spec.effect_authorization_checked]])
- **THEN** the model enters the `authorized` state and records the transition
- **VERIFIES** [[spec.effect_authorization_checked_holds]]

#### Scenario: start-effect moves `authorized` to `running`
- **WHEN** the model is in the `authorized` state and the `start_effect` transition guard holds ([[spec.effects_allowlisted]])
- **THEN** the model enters the `running` state and records the transition
- **VERIFIES** [[spec.effects_allowlisted_holds]]

#### Scenario: complete-effect moves `running` to `succeeded`
- **WHEN** the model is in the `running` state and the `complete_effect` transition guard holds ([[spec.idempotency_or_compensation_declared]])
- **THEN** the model enters the `succeeded` state and records the transition
- **VERIFIES** [[spec.idempotency_or_compensation_declared_holds]]

#### Scenario: fail-effect moves `running` to `failed`
- **WHEN** the model is in the `running` state and the `fail_effect` transition guard evaluates false (¬([[spec.idempotency_or_compensation_declared]] ∨ [[spec.partial_failure_reported]]))
- **THEN** the model enters the `failed` state and records the transition
- **VERIFIES** [[spec.idempotency_or_compensation_declared_holds]]
- **VERIFIES** [[spec.partial_failure_reported_holds]]

#### Scenario: report-partial-effect moves `running` to `partial`
- **WHEN** the model is in the `running` state and the `report_partial_effect` transition guard holds ([[spec.partial_failure_reported]])
- **THEN** the model enters the `partial` state and records the transition
- **VERIFIES** [[spec.partial_failure_reported_holds]]

#### Scenario: cancel-effect moves `authorized` to `cancelled`
- **WHEN** the model is in the `authorized` state and the `cancel_effect` transition guard holds ([[spec.preview_effects_isolated]])
- **THEN** the model enters the `cancelled` state and records the transition
- **VERIFIES** [[spec.preview_effects_isolated_holds]]

#### Scenario: core-returns-effect-intents invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Core evaluation and reduction produce effect intents as data and do not perform I/O."
- **VERIFIES** [[spec.core_returns_effect_intents_holds]]

#### Scenario: timeouts-and-budgets-enforced invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Executions enforce declared time, resource, recursion, output-size, and retry budgets."
- **VERIFIES** [[spec.timeouts_and_budgets_enforced_holds]]

#### Scenario: untrusted-code-not-in-process invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "If executable model-generated code is supported, it runs behind a separately specified isolation boundary rather than in the trusted host process."
- **VERIFIES** [[spec.untrusted_code_not_in_process_holds]]

#### Scenario: effect-outcome-can-be-unknown invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Effect execution supports an explicit unknown outcome when acknowledgement is lost or evidence is insufficient; unknown is not coerced to success or failure."
- **VERIFIES** [[spec.unknown_effect_is_representable]]

#### Scenario: retry-requires-idempotency-or-reconciliation invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A mutating effect is retryable after uncertain outcome only with a stable idempotency key/guarantee or successful reconciliation."
- **VERIFIES** [[spec.p_retry_requires_idempotency_or_reconciliation]]

#### Scenario: effect-outcome-failure invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "`effect.boundary.effect_execution_failure(detail) — a protected effect terminates without a verifiable outcome because detail; the failure is typed and evidenced, and the effect is not retried without satisfying retry_requires_idempotency_or_reconciliation`"
- **VERIFIES** [[spec.p_effect_outcome_failure]]

#### Scenario: compensation-separate-effect invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Compensation is modeled as a new effect with its own authority, failure, evidence, and verification rather than as rollback."
- **VERIFIES** [[spec.compensation_can_fail_independently]]

#### Scenario: Violating Execution and Effect Boundary invariant is rejected

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
