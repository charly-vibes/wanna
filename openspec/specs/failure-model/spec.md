---
id: spec
kind: intent
statement: WHEN execution or interaction deviates from expected behavior, THE Failure Model SHALL represent the failure scope, effect certainty, recoverability, and evidence before recovery is selected
---

# Failure Model

Failure is ordinary runtime state. A timeout, malformed AI proposal, inaccessible interaction, stale revision, partial transaction, conflicting edit, or user mistake must be represented explicitly rather than collapsed into a generic error.

A particularly important distinction is between a known failed effect and an **unknown outcome**. Loss of acknowledgement does not prove that an external side effect did not occur.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| failure_is_typed | invariant | Every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence. | [[spec]] |
| effect_certainty_explicit | invariant | For operations that may have external effects, failure records distinguish `no_effect`, `effect_applied`, `partial_effect`, and `effect_unknown`; timeout or transport failure alone cannot imply `no_effect`. | [[spec]] |
| recoverability_explicit | invariant | Failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown. | [[spec]] |
| retry_safety_explicit | invariant | A failure involving a mutating operation records whether retry is proven idempotent, requires reconciliation, or is prohibited until effect state is known. | [[spec]] |
| user_work_preserved_when_possible | invariant | Failure containment preserves validated user input, drafts, evidence, and audit history unless preservation would violate security or privacy policy. | [[spec]] |
| failure_diagnostic_non_deceptive | invariant | User-facing failure status distinguishes what is known, what failed, what may have succeeded, and what remains uncertain. | [[spec]] |
| ai_failure_contained | invariant | Malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded. | [[spec]] |
| failure_provenance_retained | invariant | Failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references. | [[spec]] |

## Model
### States
- `detected`
- `contained`
- `assessing`
- `known`
- `uncertain`
- `resolved`
- `escalated`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| contain_failure | detected | contained | [[spec.failure_is_typed]] |
| assess_failure | contained | assessing | [[spec.effect_certainty_explicit]] |
| classify_known_failure | assessing | known | [[spec.effect_certainty_explicit]] |
| classify_uncertain_failure | assessing | uncertain | [[spec.effect_certainty_explicit]] |
| resolve_known_failure | known | resolved | [[spec.recoverability_explicit]] |
| escalate_uncertain_failure | uncertain | escalated | ¬([[spec.retry_safety_explicit]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| timeout_never_implies_no_effect | unit | [[spec.effect_certainty_explicit]] | `any::<String>()` | `Fault-injection test: lost acknowledgement after a mutating request yields effect_unknown until reconciliation supplies evidence` |
| unsafe_retry_blocked | unit | [[spec.retry_safety_explicit]] | `any::<String>()` | `TypeScript test: non-idempotent unknown-effect failure cannot enter retry path` |
| preserved_draft_survives_failure | unit | [[spec.user_work_preserved_when_possible]] | `any::<String>()` | `Recovery test: recoverable infrastructure failure retains validated draft data` |
| uncertainty_visible | unit | [[spec.failure_diagnostic_non_deceptive]] | `any::<String>()` | `UX contract test: unknown effect state cannot render as definitely failed or definitely succeeded` |
| p_failure_is_typed | unit | [[spec.failure_is_typed]] | `arbitrary_state()` | `every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence` |
| p_recoverability_explicit | unit | [[spec.recoverability_explicit]] | `arbitrary_state()` | `failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown` |
| p_ai_failure_contained | unit | [[spec.ai_failure_contained]] | `arbitrary_state()` | `malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded` |
| p_failure_provenance_retained | unit | [[spec.failure_provenance_retained]] | `arbitrary_state()` | `failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references` |

## Requirements

### Requirement: Failure Model declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Failure Model invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.timeout_never_implies_no_effect]]
- **VERIFIES** [[spec.unsafe_retry_blocked]]
- **VERIFIES** [[spec.preserved_draft_survives_failure]]
- **VERIFIES** [[spec.uncertainty_visible]]
- **VERIFIES** [[spec.p_failure_is_typed]]
- **VERIFIES** [[spec.p_recoverability_explicit]]
- **VERIFIES** [[spec.p_ai_failure_contained]]
- **VERIFIES** [[spec.p_failure_provenance_retained]]

#### Scenario: Violating a Failure Model invariant is rejected

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
