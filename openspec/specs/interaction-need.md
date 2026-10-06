---
id: interaction.need
kind: intent
statement: WHEN a human-participation need is proposed, THE Need Normalizer SHALL produce a validated canonical need or an explicit unresolved result without conflating the need with a contribution primitive or workflow
---

# Human-Participation Need

A need describes *why* human participation is required now. It does not prescribe a widget, contribution primitive, workflow, or authority outcome. The initial vocabulary remains versioned and provisional: `provide_fact`, `clarify_intent`, `choose`, `rank`, `set_constraints`, `correct_artifact`, `review_artifact`, `diagnose`, `plan`, `verify_claim`, `authorize_action`, `steer_iteration`, `evaluate_result`, `teach_preference`, `coordinate`, and `monitor`.

Several of these names describe compound activities. They remain need labels for compatibility but map through policy to one or more contribution primitives/patterns; they are not declared atomic.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| need_schema_valid | invariant | A need validates against the versioned canonical schema before policy evaluation. | [[interaction.need]] |
| need_taxonomy_versioned | invariant | Every normalized need records one supported need kind and taxonomy version. | [[interaction.need]] |
| need_target_immediate | invariant | A normalized need identifies one immediate participation bottleneck; independent gaps are represented separately. | [[interaction.need]] |
| ambiguity_preserved | invariant | Missing, contradictory, ambiguous, or weak evidence remains unresolved rather than being replaced by an invented fact/default. | [[interaction.need]] |
| need_not_primitive | invariant | Need normalization does not assert that the need kind is an atomic contribution; primitive/pattern selection is a separate policy step. | [[interaction.need]] |
| need_not_presentation | invariant | Need records contain no host components, layout instructions, executable renderer code, or UI-specific authorization instructions. | [[interaction.need]] |
| need_provenance_retained | invariant | Need records retain task revision, proposal identity, evidence references, taxonomy version, and model/normalizer provenance where applicable. | [[interaction.need]] |
| confidence_advisory_only | invariant | Model confidence is advisory evidence and cannot bypass policy, authority, validation, or safety gates. | [[interaction.need]] |
| unresolved_requires_change | invariant | An unresolved need is reconsidered only after new evidence, corrected input, explicit reclassification, or changed task revision. | [[interaction.need]] |

## Model
### States
- `proposed`
- `validating`
- `normalized`
- `unresolved`
- `rejected`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_need | proposed | validating | [[interaction.need.need_schema_valid]] |
| reject_invalid_need | proposed | rejected | ¬([[interaction.need.need_schema_valid]]) |
| normalize_need | validating | normalized | [[interaction.need.need_target_immediate]] |
| preserve_unresolved_need | validating | unresolved | ¬([[interaction.need.need_target_immediate]]) |
| retry_unresolved | unresolved | proposed | [[interaction.need.unresolved_requires_change]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| need_does_not_force_primitive | unit | [[interaction.need.need_not_primitive]] | `any::<String>()` | `Policy test: a review need may map to an inspect/evaluate/verify pattern rather than a primitive named review` |
| uncertainty_not_guessed | unit | [[interaction.need.ambiguity_preserved]] | `any::<String>()` | `TypeScript test: insufficient evidence yields unresolved` |
| confidence_never_bypasses_policy | unit | [[interaction.need.confidence_advisory_only]] | `any::<String>()` | `Security test: changing model confidence alone cannot change a hard gate` |
| unchanged_unresolved_need_does_not_loop | unit | [[interaction.need.unresolved_requires_change]] | `any::<String>()` | `Runtime test: unchanged unresolved need cannot self-trigger reclassification indefinitely` |
| p_need_schema_valid | unit | [[interaction.need.need_schema_valid]] | `arbitrary_state()` | `a need validates against the versioned canonical schema before policy evaluation` |
| p_need_taxonomy_versioned | unit | [[interaction.need.need_taxonomy_versioned]] | `arbitrary_state()` | `every normalized need records one supported need kind and taxonomy version` |
| p_need_target_immediate | unit | [[interaction.need.need_target_immediate]] | `arbitrary_state()` | `a normalized need identifies one immediate participation bottleneck; independent gaps are represented separately` |
| p_need_not_presentation | unit | [[interaction.need.need_not_presentation]] | `arbitrary_state()` | `need records contain no host components, layout instructions, executable renderer code, or UI-specific authorization instructions` |
| p_need_provenance_retained | unit | [[interaction.need.need_provenance_retained]] | `arbitrary_state()` | `need records retain task revision, proposal identity, evidence references, taxonomy version, and model/normalizer provenance where applicable` |
