---
id: contribution.primitives
kind: intent
statement: THE Contribution Primitive Layer SHALL represent the smallest semantically complete human contributions independently from needs, workflows, presentation controls, and authority
---

# Human Contribution Primitives

A contribution primitive is the smallest semantically complete unit of human participation that can emit a typed event. It is not a widget and is not a multi-step workflow. Needs explain *why* human participation is required; contribution primitives describe *what semantic contribution* the human makes; interaction patterns compose primitives; presentation contracts determine *how* a host realizes them.

The initial semantic families are: `express`, `provide`, `constrain`, `select`, `order`, `allocate`, `inspect`, `annotate`, `edit`, `evaluate`, `verify`, `correct`, `delegate`, `interrupt`, `resume`, `take_over`, `authorize`, `reject`, `acknowledge`, `defer`, and `cancel`. This vocabulary is provisional and versioned: evidence or implementation experience may justify splitting, merging, or retiring primitives.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| primitive_semantically_atomic | invariant | A primitive represents one immediate semantic contribution; multi-step activities such as planning, diagnosis, review, coordination, monitoring, and clarification are modeled as interaction patterns unless irreducibility is demonstrated. | [[contribution.primitives]] |
| primitive_not_presentation | invariant | Primitive identity is independent of radio buttons, menus, dialogs, text boxes, terminal prompts, gestures, or host component names. | [[contribution.primitives]] |
| primitive_not_need | invariant | A human need may be satisfied by one or more primitives, and a primitive may satisfy multiple need kinds; neither taxonomy is silently substituted for the other. | [[contribution.primitives]] |
| primitive_not_authority | invariant | Emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant. | [[contribution.primitives]] |
| verification_distinct_from_authorization | invariant | `verify` establishes a judgment about correctness or evidence; `authorize` grants permission for an action. A verification event cannot satisfy an authorization precondition unless policy explicitly requires and separately records both semantics. | [[contribution.primitives]] |
| escape_semantics_explicit | invariant | Each primitive declares which of reject, defer, cancel, dismiss, or no-response are valid and how each affects workflow state. | [[contribution.primitives]] |
| primitive_event_typed | invariant | Every completed primitive emits a schema-valid typed event carrying primitive kind, interaction identity, task revision, response payload, and provenance. | [[contribution.primitives]] |
| primitive_taxonomy_versioned | invariant | Primitive identifiers are interpreted under an explicit taxonomy version and cannot be added or redefined silently. | [[contribution.primitives]] |

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
| validate_primitive | proposed | validated | [[contribution.primitives.primitive_semantically_atomic]] |
| reject_invalid_primitive | proposed | invalid | ¬([[contribution.primitives.primitive_semantically_atomic]]) |
| activate_primitive | validated | active | [[contribution.primitives.primitive_event_typed]] |
| complete_primitive | active | completed | [[contribution.primitives.primitive_event_typed]] |
| escape_primitive | active | escaped | [[contribution.primitives.escape_semantics_explicit]] |
| retire_primitive | completed | retired | [[contribution.primitives.primitive_taxonomy_versioned]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| compound_activity_not_mislabeled_atomic | unit | [[contribution.primitives.primitive_semantically_atomic]] | `any::<String>()` | `TypeScript test: known compound activities resolve to patterns/compositions rather than a single primitive unless an explicit taxonomy revision says otherwise` |
| rendering_does_not_change_primitive | unit | [[contribution.primitives.primitive_not_presentation]] | `any::<String>()` | `Cross-host test: web and TUI realizations preserve the same primitive kind and response semantics` |
| need_and_primitive_are_distinct | unit | [[contribution.primitives.primitive_not_need]] | `any::<String>()` | `TypeScript test: policy can map one need to multiple eligible primitives without mutating the need taxonomy` |
| verify_cannot_authorize | unit | [[contribution.primitives.verification_distinct_from_authorization]] | `any::<String>()` | `Security test: a verify event alone cannot satisfy an authorize guard` |
| escape_is_not_answer | unit | [[contribution.primitives.escape_semantics_explicit]] | `any::<String>()` | `TypeScript test: cancel/defer/dismiss outcomes are never coerced into a substantive response` |
| primitive_events_are_typed | unit | [[contribution.primitives.primitive_event_typed]] | `any::<String>()` | `TypeScript test: malformed primitive events fail before reducer execution` |
