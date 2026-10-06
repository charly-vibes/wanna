---
id: failure.model
kind: intent
statement: WHEN execution or interaction deviates from expected behavior, THE Failure Model SHALL represent the failure scope, effect certainty, recoverability, and evidence before recovery is selected
---

# Failure Model

Failure is ordinary runtime state. A timeout, malformed AI proposal, inaccessible interaction, stale revision, partial transaction, conflicting edit, or user mistake must be represented explicitly rather than collapsed into a generic error.

A particularly important distinction is between a known failed effect and an **unknown outcome**. Loss of acknowledgement does not prove that an external side effect did not occur.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| failure_is_typed | invariant | Every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence. | [[failure.model]] |
| effect_certainty_explicit | invariant | For operations that may have external effects, failure records distinguish `no_effect`, `effect_applied`, `partial_effect`, and `effect_unknown`; timeout or transport failure alone cannot imply `no_effect`. | [[failure.model]] |
| recoverability_explicit | invariant | Failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown. | [[failure.model]] |
| retry_safety_explicit | invariant | A failure involving a mutating operation records whether retry is proven idempotent, requires reconciliation, or is prohibited until effect state is known. | [[failure.model]] |
| user_work_preserved_when_possible | invariant | Failure containment preserves validated user input, drafts, evidence, and audit history unless preservation would violate security or privacy policy. | [[failure.model]] |
| failure_diagnostic_non_deceptive | invariant | User-facing failure status distinguishes what is known, what failed, what may have succeeded, and what remains uncertain. | [[failure.model]] |
| ai_failure_contained | invariant | Malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded. | [[failure.model]] |
| failure_provenance_retained | invariant | Failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references. | [[failure.model]] |

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
| contain_failure | detected | contained | [[failure.model.failure_is_typed]] |
| assess_failure | contained | assessing | [[failure.model.effect_certainty_explicit]] |
| classify_known_failure | assessing | known | [[failure.model.effect_certainty_explicit]] |
| classify_uncertain_failure | assessing | uncertain | [[failure.model.effect_certainty_explicit]] |
| resolve_known_failure | known | resolved | [[failure.model.recoverability_explicit]] |
| escalate_uncertain_failure | uncertain | escalated | ¬([[failure.model.retry_safety_explicit]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| timeout_never_implies_no_effect | unit | [[failure.model.effect_certainty_explicit]] | `any::<String>()` | `Fault-injection test: lost acknowledgement after a mutating request yields effect_unknown until reconciliation supplies evidence` |
| unsafe_retry_blocked | unit | [[failure.model.retry_safety_explicit]] | `any::<String>()` | `TypeScript test: non-idempotent unknown-effect failure cannot enter retry path` |
| preserved_draft_survives_failure | unit | [[failure.model.user_work_preserved_when_possible]] | `any::<String>()` | `Recovery test: recoverable infrastructure failure retains validated draft data` |
| uncertainty_visible | unit | [[failure.model.failure_diagnostic_non_deceptive]] | `any::<String>()` | `UX contract test: unknown effect state cannot render as definitely failed or definitely succeeded` |
