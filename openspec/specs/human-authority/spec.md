---
id: spec
kind: intent
statement: THE Human Authority Layer SHALL enforce authorization independently of presentation, model confidence, and interaction completion
---

# Human Authority and Approval

An interaction may collect consent, review, or approval, but rendering a button or receiving a click is not by itself proof of authorization. Authorization is evaluated at the trusted effect boundary against the current identity, scope, action, resource, policy version, and revision. Approval is scoped and expires or becomes stale when its material preconditions change.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| approval_scope_explicit | invariant | Every approval identifies the principal, action, resource scope, risk class, reviewed revision, and expiry or invalidation conditions. | [[spec]] |
| authorization_at_execution | invariant | Protected effects re-check authorization at execution time rather than relying solely on the UI state. | [[spec]] |
| approval_invalidated_on_material_change | invariant | A material change to the action, target, evidence, or relevant revision invalidates the previous approval unless policy explicitly permits reuse. | [[spec]] |
| model_cannot_self_approve | invariant | A model-generated proposal or confidence score cannot satisfy a required human or external authority requirement. | [[spec]] |
| denial_is_terminal_for_attempt | invariant | A denied authorization attempt cannot be retried as authorized without a new approval or changed request under policy. | [[spec]] |
| approval_audited | invariant | Approval and denial outcomes are recorded with sufficient provenance for later review while minimizing sensitive data. | [[spec]] |

| authority_sources_explicit | invariant | Protected authority may derive from immediate approval, prior delegated authority, bounded automation grants, role policy, or organizational policy; every source is explicit, scoped, revocable/expiring where applicable, and auditable. | [[spec]] |
| verification_not_authority | invariant | Verification, acknowledgement, recommendation, model confidence, and authentication do not satisfy an authorization requirement unless a separate applicable authority grant exists. | [[spec]] |

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
| request_approval | not_required | pending | [[spec.approval_scope_explicit]] |
| grant_approval | pending | approved | [[spec.authorization_at_execution]] |
| deny_approval | pending | denied | ¬([[spec.authorization_at_execution]]) |
| expire_approval | approved | expired | [[spec.approval_scope_explicit]] |
| invalidate_approval | approved | invalidated | [[spec.approval_invalidated_on_material_change]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| approval_scope_explicit_holds | unit | [[spec.approval_scope_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_scope_explicit at its trust boundary and under its stated edge cases.` |
| authorization_at_execution_holds | unit | [[spec.authorization_at_execution]] | `any::<String>()` | `TypeScript conformance test: assert invariant authorization_at_execution at its trust boundary and under its stated edge cases.` |
| approval_invalidated_on_material_change_holds | unit | [[spec.approval_invalidated_on_material_change]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_invalidated_on_material_change at its trust boundary and under its stated edge cases.` |
| model_cannot_self_approve_holds | unit | [[spec.model_cannot_self_approve]] | `any::<String>()` | `TypeScript conformance test: assert invariant model_cannot_self_approve at its trust boundary and under its stated edge cases.` |
| denial_is_terminal_for_attempt_holds | unit | [[spec.denial_is_terminal_for_attempt]] | `any::<String>()` | `TypeScript conformance test: assert invariant denial_is_terminal_for_attempt at its trust boundary and under its stated edge cases.` |
| approval_audited_holds | unit | [[spec.approval_audited]] | `any::<String>()` | `TypeScript conformance test: assert invariant approval_audited at its trust boundary and under its stated edge cases.` |
| delegated_authority_supported | unit | [[spec.authority_sources_explicit]] | `any::<String>()` | `Policy test: bounded unattended automation can proceed only inside an explicit grant` |
| reauthentication_not_approval | unit | [[spec.verification_not_authority]] | `any::<String>()` | `Security test: authentication success alone cannot approve pending protected effect` |

## Requirements

### Requirement: Human Authority and Approval declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Human Authority and Approval invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.approval_scope_explicit_holds]]
- **VERIFIES** [[spec.authorization_at_execution_holds]]
- **VERIFIES** [[spec.approval_invalidated_on_material_change_holds]]
- **VERIFIES** [[spec.model_cannot_self_approve_holds]]
- **VERIFIES** [[spec.denial_is_terminal_for_attempt_holds]]
- **VERIFIES** [[spec.approval_audited_holds]]
- **VERIFIES** [[spec.delegated_authority_supported]]
- **VERIFIES** [[spec.reauthentication_not_approval]]

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
