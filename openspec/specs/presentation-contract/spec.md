---
id: spec
kind: intent
statement: THE Presentation Contract Layer SHALL translate validated interaction intent into host-neutral semantic presentation data
---

# Presentation Contract

A presentation contract describes the semantic role of an interaction, its content hierarchy, density, layout hints, and accessibility requirements. It does not name arbitrary host components or contain HTML, CSS, scripts, event handlers, or executable expressions. A host maps the contract onto its own trusted component catalog.

Semantic intent is portable; exact visual rendering is host-specific. The same interaction should preserve meaning, response schema, and safety requirements even when a Pi TUI uses a compact form and a web host uses a richer layout.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| semantic_role_required | invariant | Every presentation contract declares a supported semantic role such as clarify, choose, compare, edit, inspect, verify, or authorize. | [[spec]] |
| host_component_names_forbidden | invariant | Presentation data references semantic component roles, not arbitrary host component names, module paths, or executable render functions. | [[spec]] |
| content_hierarchy_explicit | invariant | A presentation contract identifies primary task, supporting context, optional detail, and available actions as distinct fields. | [[spec]] |
| density_bounded | invariant | Presentation density, item count, nesting depth, and content size obey catalog-defined limits. | [[spec]] |
| response_semantics_preserved | invariant | Host rendering cannot change the declared response schema or action meaning. | [[spec]] |
| fallback_is_semantic | invariant | When a host lacks a preferred presentation capability, it uses a documented semantically equivalent fallback or returns unsupported. | [[spec]] |
| untrusted_text_inert | invariant | User- or model-provided text is rendered as inert text and never interpreted as markup or executable content. | [[spec]] |

| active_interaction_stable | invariant | A host must not reorder, replace, or semantically remap the active response surface during input except for a safety-critical transition or explicit user acceptance. | [[spec]] |
| adaptation_reason_available | invariant | Material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option. | [[spec]] |
| uncertainty_semantics_preserved | invariant | Presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities. | [[spec]] |

## Model
### States
- `proposed`
- `validated`
- `renderable`
- `fallback`
- `unsupported`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_presentation | proposed | validated | [[spec.semantic_role_required]] |
| reject_presentation | proposed | unsupported | ¬([[spec.semantic_role_required]]) |
| render_with_capabilities | validated | renderable | [[spec.response_semantics_preserved]] |
| use_semantic_fallback | validated | fallback | [[spec.fallback_is_semantic]] |
| retire_presentation | renderable | retired | [[spec.density_bounded]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| semantic_role_required_holds | unit | [[spec.semantic_role_required]] | `any::<String>()` | `TypeScript conformance test: assert invariant semantic_role_required at its trust boundary and under its stated edge cases.` |
| host_component_names_forbidden_holds | unit | [[spec.host_component_names_forbidden]] | `any::<String>()` | `TypeScript conformance test: assert invariant host_component_names_forbidden at its trust boundary and under its stated edge cases.` |
| content_hierarchy_explicit_holds | unit | [[spec.content_hierarchy_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant content_hierarchy_explicit at its trust boundary and under its stated edge cases.` |
| density_bounded_holds | unit | [[spec.density_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant density_bounded at its trust boundary and under its stated edge cases.` |
| response_semantics_preserved_holds | unit | [[spec.response_semantics_preserved]] | `any::<String>()` | `TypeScript conformance test: assert invariant response_semantics_preserved at its trust boundary and under its stated edge cases.` |
| fallback_is_semantic_holds | unit | [[spec.fallback_is_semantic]] | `any::<String>()` | `TypeScript conformance test: assert invariant fallback_is_semantic at its trust boundary and under its stated edge cases.` |
| untrusted_text_inert_holds | unit | [[spec.untrusted_text_inert]] | `any::<String>()` | `TypeScript conformance test: assert invariant untrusted_text_inert at its trust boundary and under its stated edge cases.` |
| mid_input_layout_semantics_stable | unit | [[spec.active_interaction_stable]] | `any::<String>()` | `Cross-host interaction test: active semantic actions remain stable during entry` |
| p_adaptation_reason_available | unit | [[spec.adaptation_reason_available]] | `arbitrary_state()` | `material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option` |
| p_uncertainty_semantics_preserved | unit | [[spec.uncertainty_semantics_preserved]] | `arbitrary_state()` | `presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities` |

## Requirements

### Requirement: Presentation Contract model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-presentation moves `proposed` to `validated`
- **WHEN** the model is in the `proposed` state and the `validate_presentation` transition guard holds ([[spec.semantic_role_required]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.semantic_role_required_holds]]

#### Scenario: reject-presentation moves `proposed` to `unsupported`
- **WHEN** the model is in the `proposed` state and the `reject_presentation` transition guard evaluates false (¬([[spec.semantic_role_required]]))
- **THEN** the model enters the `unsupported` state and records the transition
- **VERIFIES** [[spec.semantic_role_required_holds]]

#### Scenario: render-with-capabilities moves `validated` to `renderable`
- **WHEN** the model is in the `validated` state and the `render_with_capabilities` transition guard holds ([[spec.response_semantics_preserved]])
- **THEN** the model enters the `renderable` state and records the transition
- **VERIFIES** [[spec.response_semantics_preserved_holds]]

#### Scenario: use-semantic-fallback moves `validated` to `fallback`
- **WHEN** the model is in the `validated` state and the `use_semantic_fallback` transition guard holds ([[spec.fallback_is_semantic]])
- **THEN** the model enters the `fallback` state and records the transition
- **VERIFIES** [[spec.fallback_is_semantic_holds]]

#### Scenario: retire-presentation moves `renderable` to `retired`
- **WHEN** the model is in the `renderable` state and the `retire_presentation` transition guard holds ([[spec.density_bounded]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[spec.density_bounded_holds]]

#### Scenario: host-component-names-forbidden invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Presentation data references semantic component roles, not arbitrary host component names, module paths, or executable render functions."
- **VERIFIES** [[spec.host_component_names_forbidden_holds]]

#### Scenario: content-hierarchy-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A presentation contract identifies primary task, supporting context, optional detail, and available actions as distinct fields."
- **VERIFIES** [[spec.content_hierarchy_explicit_holds]]

#### Scenario: untrusted-text-inert invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "User- or model-provided text is rendered as inert text and never interpreted as markup or executable content."
- **VERIFIES** [[spec.untrusted_text_inert_holds]]

#### Scenario: active-interaction-stable invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A host must not reorder, replace, or semantically remap the active response surface during input except for a safety-critical transition or explicit user acceptance."
- **VERIFIES** [[spec.mid_input_layout_semantics_stable]]

#### Scenario: adaptation-reason-available invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option."
- **VERIFIES** [[spec.p_adaptation_reason_available]]

#### Scenario: uncertainty-semantics-preserved invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities."
- **VERIFIES** [[spec.p_uncertainty_semantics_preserved]]

#### Scenario: Violating Presentation Contract invariant is rejected

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
