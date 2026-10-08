---
id: human.authority
kind: intent
statement: THE Human Authority Layer SHALL enforce authorization independently of presentation, model confidence, and interaction completion
---

# Human Authority and Approval

An interaction may collect consent, review, or approval, but rendering a button or receiving a click is not by itself proof of authorization. Authorization is evaluated at the trusted effect boundary against the current identity, scope, action, resource, policy version, and revision. Approval is scoped and expires or becomes stale when its material preconditions change.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| approval_scope_explicit | invariant | Every approval identifies the principal, action, resource scope, risk class, reviewed revision, and expiry or invalidation conditions. | [[human.authority]] |
| authorization_at_execution | invariant | Protected effects re-check authorization at execution time rather than relying solely on the UI state. | [[human.authority]] |
| approval_invalidated_on_material_change | invariant | A material change to the action, target, evidence, or relevant revision invalidates the previous approval unless policy explicitly permits reuse. | [[human.authority]] |
| model_cannot_self_approve | invariant | A model-generated proposal or confidence score cannot satisfy a required human or external authority requirement. | [[human.authority]] |
| denial_is_terminal_for_attempt | invariant | A denied authorization attempt cannot be retried as authorized without a new approval or changed request under policy. | [[human.authority]] |
| approval_audited | invariant | Approval and denial outcomes are recorded with sufficient provenance for later review while minimizing sensitive data. | [[human.authority]] |

| authority_sources_explicit | invariant | Protected authority may derive from immediate approval, prior delegated authority, bounded automation grants, role policy, or organizational policy; every source is explicit, scoped, revocable/expiring where applicable, and auditable. | [[human.authority]] |
| verification_not_authority | invariant | Verification, acknowledgement, recommendation, model confidence, and authentication do not satisfy an authorization requirement unless a separate applicable authority grant exists. | [[human.authority]] |

## Model
### States
- `not_required`
- `pending`
- `approved`
- `denied`
- `expired`
- `invalidated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| request_approval | not_required | pending | [[human.authority.approval_scope_explicit]] |
| grant_approval | pending | approved | [[human.authority.authorization_at_execution]] |
| deny_approval | pending | denied | ¬([[human.authority.authorization_at_execution]]) |
| expire_approval | approved | expired | [[human.authority.approval_scope_explicit]] |
| invalidate_approval | approved | invalidated | [[human.authority.approval_invalidated_on_material_change]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| approval_scope_explicit_holds | unit | [[human.authority.approval_scope_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_scope_explicit at its trust boundary and under its stated edge cases.` |
| authorization_at_execution_holds | unit | [[human.authority.authorization_at_execution]] | `any::<String>()` | `TypeScript conformance test: assert invariant authorization_at_execution at its trust boundary and under its stated edge cases.` |
| approval_invalidated_on_material_change_holds | unit | [[human.authority.approval_invalidated_on_material_change]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_invalidated_on_material_change at its trust boundary and under its stated edge cases.` |
| model_cannot_self_approve_holds | unit | [[human.authority.model_cannot_self_approve]] | `any::<String>()` | `TypeScript conformance test: assert invariant model_cannot_self_approve at its trust boundary and under its stated edge cases.` |
| denial_is_terminal_for_attempt_holds | unit | [[human.authority.denial_is_terminal_for_attempt]] | `any::<String>()` | `TypeScript conformance test: assert invariant denial_is_terminal_for_attempt at its trust boundary and under its stated edge cases.` |
| approval_audited_holds | unit | [[human.authority.approval_audited]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_audited at its trust boundary and under its stated edge cases.` |
| delegated_authority_supported | unit | [[human.authority.authority_sources_explicit]] | `any::<String>()` | `Policy test: bounded unattended automation can proceed only inside an explicit grant` |
| reauthentication_not_approval | unit | [[human.authority.verification_not_authority]] | `any::<String>()` | `Security test: authentication success alone cannot approve pending protected effect` |

## Requirements

### Requirement: Human Authority and Approval model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: request-approval moves `not_required` to `pending`
- **WHEN** the model is in the `not_required` state and the `request_approval` transition guard holds ([[human.authority.approval_scope_explicit]])
- **THEN** the model enters the `pending` state and records the transition
- **VERIFIES** [[human.authority.approval_scope_explicit_holds]]

#### Scenario: grant-approval moves `pending` to `approved`
- **WHEN** the model is in the `pending` state and the `grant_approval` transition guard holds ([[human.authority.authorization_at_execution]])
- **THEN** the model enters the `approved` state and records the transition
- **VERIFIES** [[human.authority.authorization_at_execution_holds]]

#### Scenario: deny-approval moves `pending` to `denied`
- **WHEN** the model is in the `pending` state and the `deny_approval` transition guard evaluates false (¬([[human.authority.authorization_at_execution]]))
- **THEN** the model enters the `denied` state and records the transition
- **VERIFIES** [[human.authority.authorization_at_execution_holds]]

#### Scenario: expire-approval moves `approved` to `expired`
- **WHEN** the model is in the `approved` state and the `expire_approval` transition guard holds ([[human.authority.approval_scope_explicit]])
- **THEN** the model enters the `expired` state and records the transition
- **VERIFIES** [[human.authority.approval_scope_explicit_holds]]

#### Scenario: invalidate-approval moves `approved` to `invalidated`
- **WHEN** the model is in the `approved` state and the `invalidate_approval` transition guard holds ([[human.authority.approval_invalidated_on_material_change]])
- **THEN** the model enters the `invalidated` state and records the transition
- **VERIFIES** [[human.authority.approval_invalidated_on_material_change_holds]]

#### Scenario: model-cannot-self-approve invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A model-generated proposal or confidence score cannot satisfy a required human or external authority requirement."
- **VERIFIES** [[human.authority.model_cannot_self_approve_holds]]

#### Scenario: denial-is-terminal-for-attempt invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A denied authorization attempt cannot be retried as authorized without a new approval or changed request under policy."
- **VERIFIES** [[human.authority.denial_is_terminal_for_attempt_holds]]

#### Scenario: approval-audited invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Approval and denial outcomes are recorded with sufficient provenance for later review while minimizing sensitive data."
- **VERIFIES** [[human.authority.approval_audited_holds]]

#### Scenario: authority-sources-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Protected authority may derive from immediate approval, prior delegated authority, bounded automation grants, role policy, or organizational policy; every source is explicit, scoped, revocable/expiring where applicable, and auditable."
- **VERIFIES** [[human.authority.delegated_authority_supported]]

#### Scenario: verification-not-authority invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Verification, acknowledgement, recommendation, model confidence, and authentication do not satisfy an authorization requirement unless a separate applicable authority grant exists."
- **VERIFIES** [[human.authority.reauthentication_not_approval]]

#### Scenario: Violating Human Authority and Approval invariant is rejected

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
