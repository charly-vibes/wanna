---
id: spec
kind: intent
statement: THE Contribution Primitive Layer SHALL represent the smallest semantically complete human contributions independently from needs, workflows, presentation controls, and authority
---

# Human Contribution Primitives

A contribution primitive is the smallest semantically complete unit of human participation that can emit a typed event. It is not a widget and is not a multi-step workflow. Needs explain *why* human participation is required; contribution primitives describe *what semantic contribution* the human makes; interaction patterns compose primitives; presentation contracts determine *how* a host realizes them.

The initial semantic families are: `express`, `provide`, `constrain`, `select`, `order`, `allocate`, `inspect`, `annotate`, `edit`, `evaluate`, `verify`, `correct`, `delegate`, `interrupt`, `resume`, `take_over`, `authorize`, `reject`, `acknowledge`, `defer`, and `cancel`. This vocabulary is provisional and versioned: evidence or implementation experience may justify splitting, merging, or retiring primitives.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| primitive_semantically_atomic | invariant | A primitive represents one immediate semantic contribution; multi-step activities such as planning, diagnosis, review, coordination, monitoring, and clarification are modeled as interaction patterns unless irreducibility is demonstrated. | [[spec]] |
| primitive_not_presentation | invariant | Primitive identity is independent of radio buttons, menus, dialogs, text boxes, terminal prompts, gestures, or host component names. | [[spec]] |
| primitive_not_need | invariant | A human need may be satisfied by one or more primitives, and a primitive may satisfy multiple need kinds; neither taxonomy is silently substituted for the other. | [[spec]] |
| primitive_not_authority | invariant | Emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant. | [[spec]] |
| verification_distinct_from_authorization | invariant | `verify` establishes a judgment about correctness or evidence; `authorize` grants permission for an action. A verification event cannot satisfy an authorization precondition unless policy explicitly requires and separately records both semantics. | [[spec]] |
| escape_semantics_explicit | invariant | Each primitive declares which of reject, defer, cancel, dismiss, or no-response are valid and how each affects workflow state. | [[spec]] |
| primitive_event_typed | invariant | Every completed primitive emits a schema-valid typed event carrying primitive kind, interaction identity, task revision, response payload, and provenance. | [[spec]] |
| primitive_taxonomy_versioned | invariant | Primitive identifiers are interpreted under an explicit taxonomy version and cannot be added or redefined silently. | [[spec]] |

## Model
### States
- `proposed`
- `validated`
- `active`
- `completed`
- `escaped`
- `invalid`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_primitive | proposed | validated | [[spec.primitive_semantically_atomic]] |
| reject_invalid_primitive | proposed | invalid | ¬([[spec.primitive_semantically_atomic]]) |
| activate_primitive | validated | active | [[spec.primitive_event_typed]] |
| complete_primitive | active | completed | [[spec.primitive_event_typed]] |
| escape_primitive | active | escaped | [[spec.escape_semantics_explicit]] |
| retire_primitive | completed | retired | [[spec.primitive_taxonomy_versioned]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| compound_activity_not_mislabeled_atomic | unit | [[spec.primitive_semantically_atomic]] | `any::<String>()` | `TypeScript test: known compound activities resolve to patterns/compositions rather than a single primitive unless an explicit taxonomy revision says otherwise` |
| rendering_does_not_change_primitive | unit | [[spec.primitive_not_presentation]] | `any::<String>()` | `Cross-host test: web and TUI realizations preserve the same primitive kind and response semantics` |
| need_and_primitive_are_distinct | unit | [[spec.primitive_not_need]] | `any::<String>()` | `TypeScript test: policy can map one need to multiple eligible primitives without mutating the need taxonomy` |
| verify_cannot_authorize | unit | [[spec.verification_distinct_from_authorization]] | `any::<String>()` | `Security test: a verify event alone cannot satisfy an authorize guard` |
| escape_is_not_answer | unit | [[spec.escape_semantics_explicit]] | `any::<String>()` | `TypeScript test: cancel/defer/dismiss outcomes are never coerced into a substantive response` |
| primitive_events_are_typed | unit | [[spec.primitive_event_typed]] | `any::<String>()` | `TypeScript test: malformed primitive events fail before reducer execution` |
| p_primitive_not_authority | unit | [[spec.primitive_not_authority]] | `arbitrary_state()` | `emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant` |
| p_primitive_taxonomy_versioned | unit | [[spec.primitive_taxonomy_versioned]] | `arbitrary_state()` | `primitive identifiers are interpreted under an explicit taxonomy version and cannot be added or redefined silently` |

## Requirements

### Requirement: Human Contribution Primitives declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Human Contribution Primitives invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.compound_activity_not_mislabeled_atomic]]
- **VERIFIES** [[spec.rendering_does_not_change_primitive]]
- **VERIFIES** [[spec.need_and_primitive_are_distinct]]
- **VERIFIES** [[spec.verify_cannot_authorize]]
- **VERIFIES** [[spec.escape_is_not_answer]]
- **VERIFIES** [[spec.primitive_events_are_typed]]
- **VERIFIES** [[spec.p_primitive_not_authority]]
- **VERIFIES** [[spec.p_primitive_taxonomy_versioned]]

#### Scenario: Violating Human Contribution Primitives invariant is rejected

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
