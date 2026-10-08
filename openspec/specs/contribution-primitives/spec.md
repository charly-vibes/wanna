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
| verify_cannot_authorize | unit | [[contribution.primitives.verification_distinct_from_authorization]] | `fc.string({minLength:1}) interactionId x fc.array(fc.record({interactionId: fc.string({minLength:1}), kind: fc.constantFrom("authorize","verify","select")})) grant sets` | `Security test: a verify event alone cannot satisfy an authorize guard` |
| escape_is_not_answer | unit | [[contribution.primitives.escape_semantics_explicit]] | `fc.record({kind: fc.constantFrom("select","confirm","annotate","verify","authorize","reject")}) proposals x fc.option(fc.constantFrom("reject","defer","cancel","dismiss","no_response")) escape outcomes` | `TypeScript test: cancel/defer/dismiss outcomes are never coerced into a substantive response` |
| primitive_events_are_typed | unit | [[contribution.primitives.primitive_event_typed]] | `any::<String>()` | `TypeScript test: malformed primitive events fail before reducer execution` |
| p_primitive_not_authority | unit | [[contribution.primitives.primitive_not_authority]] | `arbitrary_state()` | `emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant` |
| p_primitive_taxonomy_versioned | unit | [[contribution.primitives.primitive_taxonomy_versioned]] | `arbitrary_state()` | `primitive identifiers are interpreted under an explicit taxonomy version and cannot be added or redefined silently` |

## Requirements

### Requirement: Human Contribution Primitives model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-primitive moves `proposed` to `validated`
- **WHEN** the model is in the `proposed` state and the `validate_primitive` transition guard holds ([[contribution.primitives.primitive_semantically_atomic]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[contribution.primitives.compound_activity_not_mislabeled_atomic]]

#### Scenario: reject-invalid-primitive moves `proposed` to `invalid`
- **WHEN** the model is in the `proposed` state and the `reject_invalid_primitive` transition guard evaluates false (¬([[contribution.primitives.primitive_semantically_atomic]]))
- **THEN** the model enters the `invalid` state and records the transition
- **VERIFIES** [[contribution.primitives.compound_activity_not_mislabeled_atomic]]

#### Scenario: activate-primitive moves `validated` to `active`
- **WHEN** the model is in the `validated` state and the `activate_primitive` transition guard holds ([[contribution.primitives.primitive_event_typed]])
- **THEN** the model enters the `active` state and records the transition
- **VERIFIES** [[contribution.primitives.primitive_events_are_typed]]

#### Scenario: complete-primitive moves `active` to `completed`
- **WHEN** the model is in the `active` state and the `complete_primitive` transition guard holds ([[contribution.primitives.primitive_event_typed]])
- **THEN** the model enters the `completed` state and records the transition
- **VERIFIES** [[contribution.primitives.primitive_events_are_typed]]

#### Scenario: escape-primitive moves `active` to `escaped`
- **WHEN** the model is in the `active` state and the `escape_primitive` transition guard holds ([[contribution.primitives.escape_semantics_explicit]])
- **THEN** the model enters the `escaped` state and records the transition
- **VERIFIES** [[contribution.primitives.escape_is_not_answer]]

#### Scenario: retire-primitive moves `completed` to `retired`
- **WHEN** the model is in the `completed` state and the `retire_primitive` transition guard holds ([[contribution.primitives.primitive_taxonomy_versioned]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[contribution.primitives.p_primitive_taxonomy_versioned]]

#### Scenario: primitive-not-presentation invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Primitive identity is independent of radio buttons, menus, dialogs, text boxes, terminal prompts, gestures, or host component names."
- **VERIFIES** [[contribution.primitives.rendering_does_not_change_primitive]]

#### Scenario: primitive-not-need invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A human need may be satisfied by one or more primitives, and a primitive may satisfy multiple need kinds; neither taxonomy is silently substituted for the other."
- **VERIFIES** [[contribution.primitives.need_and_primitive_are_distinct]]

#### Scenario: primitive-not-authority invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant."
- **VERIFIES** [[contribution.primitives.p_primitive_not_authority]]

#### Scenario: verification-distinct-from-authorization invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "`verify` establishes a judgment about correctness or evidence; `authorize` grants permission for an action. A verification event cannot satisfy an authorization precondition unless policy explicitly requires and separately records both semantics."
- **VERIFIES** [[contribution.primitives.verify_cannot_authorize]]

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
