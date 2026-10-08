---
id: spec
kind: intent
statement: WHEN a human-participation need is proposed, THE Need Normalizer SHALL produce a validated canonical need or an explicit unresolved result without conflating the need with a contribution primitive or workflow
---

# Human-Participation Need

A need describes *why* human participation is required now. It does not prescribe a widget, contribution primitive, workflow, or authority outcome. The initial vocabulary remains versioned and provisional: `provide_fact`, `clarify_intent`, `choose`, `rank`, `set_constraints`, `correct_artifact`, `review_artifact`, `diagnose`, `plan`, `verify_claim`, `authorize_action`, `steer_iteration`, `evaluate_result`, `teach_preference`, `coordinate`, and `monitor`.

Several of these names describe compound activities. They remain need labels for compatibility but map through policy to one or more contribution primitives/patterns; they are not declared atomic.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| need_schema_valid | invariant | A need validates against the versioned canonical schema before policy evaluation. | [[spec]] |
| need_taxonomy_versioned | invariant | Every normalized need records one supported need kind and taxonomy version. | [[spec]] |
| need_target_immediate | invariant | A normalized need identifies one immediate participation bottleneck; independent gaps are represented separately. | [[spec]] |
| ambiguity_preserved | invariant | Missing, contradictory, ambiguous, or weak evidence remains unresolved rather than being replaced by an invented fact/default. | [[spec]] |
| need_not_primitive | invariant | Need normalization does not assert that the need kind is an atomic contribution; primitive/pattern selection is a separate policy step. | [[spec]] |
| need_not_presentation | invariant | Need records contain no host components, layout instructions, executable renderer code, or UI-specific authorization instructions. | [[spec]] |
| need_provenance_retained | invariant | Need records retain task revision, proposal identity, evidence references, taxonomy version, and model/normalizer provenance where applicable. | [[spec]] |
| confidence_advisory_only | invariant | Model confidence is advisory evidence and cannot bypass policy, authority, validation, or safety gates. | [[spec]] |
| unresolved_requires_change | invariant | An unresolved need is reconsidered only after new evidence, corrected input, explicit reclassification, or changed task revision. | [[spec]] |

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
| validate_need | proposed | validating | [[spec.need_schema_valid]] |
| reject_invalid_need | proposed | rejected | ¬([[spec.need_schema_valid]]) |
| normalize_need | validating | normalized | [[spec.need_target_immediate]] |
| preserve_unresolved_need | validating | unresolved | ¬([[spec.need_target_immediate]]) |
| retry_unresolved | unresolved | proposed | [[spec.unresolved_requires_change]] |

## Requirements

### Requirement: Canonical Need Normalization

The Need Normalizer SHALL accept a proposed need, validate it against the
versioned canonical schema, and produce either a normalized need or an
explicit unresolved result. Every normalized need records one supported
need kind, the taxonomy version in effect, and identifies exactly one
immediate participation bottleneck; independent gaps are represented as
separate needs.

#### Scenario: Valid need normalizes with taxonomy provenance

- **WHEN** a need proposal is normalized with a supported need kind,
  an immediate target, and complete provenance inputs
- **THEN** the result is a validated canonical need that records the
  need kind, the taxonomy version, and the task/proposal/evidence
  provenance retained verbatim
- **VERIFIES** [[spec.p_need_schema_valid]]
- **VERIFIES** [[spec.p_need_taxonomy_versioned]]
- **VERIFIES** [[spec.p_need_target_immediate]]
- **VERIFIES** [[spec.p_need_provenance_retained]]

#### Scenario: Schema-invalid proposal stays unresolved

- **WHEN** a need proposal fails canonical schema validation (missing
  target, unsupported kind, or unknown taxonomy version)
- **THEN** the result is an explicit unresolved outcome and no
  normalized need is emitted into policy evaluation
- **VERIFIES** [[spec.p_need_schema_valid]]

### Requirement: Needs Are Presentation-Free and Policy-Bounded

A need describes why human participation is required; it never prescribes
host components, layout, executable renderer code, or UI-specific
authorization instructions, and it never collapses a compound human
activity into a claimed atomic primitive. Model confidence is advisory
only and an unresolved need does not loop on unchanged inputs.

#### Scenario: Need record leaks no presentation vocabulary

- **WHEN** a normalized need record is inspected for host-component,
  layout, executable-renderer, or UI-authorization content
- **THEN** none is present — the record names only the need, its
  target, and its provenance
- **VERIFIES** [[spec.p_need_not_presentation]]
- **VERIFIES** [[spec.need_does_not_force_primitive]]

#### Scenario: Confidence cannot override a hard policy gate

- **WHEN** a model raises its confidence score on an unresolved need
  without any change in task state or evidence
- **THEN** the policy gate outcome is unchanged — confidence alone
  cannot promote the need or resolve the ambiguity
- **VERIFIES** [[spec.confidence_never_bypasses_policy]]
- **VERIFIES** [[spec.unchanged_unresolved_need_does_not_loop]]
- **VERIFIES** [[spec.uncertainty_not_guessed]]

#### Scenario: Need embedding presentation instructions is rejected

- **WHEN** a need proposal carries host components, layout instructions, executable renderer code, or UI-specific authorization instructions
- **THEN** normalization rejects the proposal as schema-invalid and emits an explicit unresolved result naming the leaked presentation vocabulary
- **VERIFIES** [[spec.p_need_not_presentation]]

## Properties

| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| need_does_not_force_primitive | unit | [[spec.need_not_primitive]] | `any::<String>()` | `Policy test: a review need may map to an inspect/evaluate/verify pattern rather than a primitive named review` |
| uncertainty_not_guessed | unit | [[spec.ambiguity_preserved]] | `any::<String>()` | `TypeScript test: insufficient evidence yields unresolved` |
| confidence_never_bypasses_policy | unit | [[spec.confidence_advisory_only]] | `fc.nat({max:100})/100 confidence pairs over arbitrary well-formed proposals — validity and unresolved-retry guards are invariant to confidence` | `Security test: changing model confidence alone cannot change a hard gate` |
| unchanged_unresolved_need_does_not_loop | unit | [[spec.unresolved_requires_change]] | `any::<String>()` | `Runtime test: unchanged unresolved need cannot self-trigger reclassification indefinitely` |
| p_need_schema_valid | unit | [[spec.need_schema_valid]] | `fc.record({kind: fc.constantFrom(...NEED_KINDS), target: fc.stringMatching(/^[a-z ]{8,60}$/) filtered to exclude presentation vocabulary, taskRevision/proposalId: fc.stringMatching(/^task-|^need-prop-[0-9]{1,4}$/), evidenceRefs: fc.array(fc.stringMatching(/^ev-[0-9]{1,3}$/), {minLength:1}), evidenceStrength: fc.constantFrom("missing","contradictory","ambiguous","weak","sufficient")}) x injected single-field violations` | `a need validates against the versioned canonical schema before policy evaluation` |
| p_need_taxonomy_versioned | unit | [[spec.need_taxonomy_versioned]] | `arbitrary_state()` | `every normalized need records one supported need kind and taxonomy version` |
| p_need_target_immediate | unit | [[spec.need_target_immediate]] | `arbitrary_state()` | `a normalized need identifies one immediate participation bottleneck; independent gaps are represented separately` |
| p_need_not_presentation | unit | [[spec.need_not_presentation]] | `arbitrary_state()` | `need records contain no host components, layout instructions, executable renderer code, or UI-specific authorization instructions` |
| p_need_provenance_retained | unit | [[spec.need_provenance_retained]] | `arbitrary_state()` | `need records retain task revision, proposal identity, evidence references, taxonomy version, and model/normalizer provenance where applicable` |

## Non-Goals

- Concrete host presentation — widget choice, layout, visual styling, and
  component-library specifics — is out of scope; this specification governs
  interaction semantics, not implementation.
- Runtime performance, storage formats, and host adapter mechanics are
  governed by their own specifications and are not restated here.
- Empirical human usability validation is out of scope; conformance here is
  structural and behavioral, not user-research evidence.
