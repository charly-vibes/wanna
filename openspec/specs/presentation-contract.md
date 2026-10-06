---
id: presentation.contract
kind: intent
statement: THE Presentation Contract Layer SHALL translate validated interaction intent into host-neutral semantic presentation data
---

# Presentation Contract

A presentation contract describes the semantic role of an interaction, its content hierarchy, density, layout hints, and accessibility requirements. It does not name arbitrary host components or contain HTML, CSS, scripts, event handlers, or executable expressions. A host maps the contract onto its own trusted component catalog.

Semantic intent is portable; exact visual rendering is host-specific. The same interaction should preserve meaning, response schema, and safety requirements even when a Pi TUI uses a compact form and a web host uses a richer layout.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| semantic_role_required | invariant | Every presentation contract declares a supported semantic role such as clarify, choose, compare, edit, inspect, verify, or authorize. | [[presentation.contract]] |
| host_component_names_forbidden | invariant | Presentation data references semantic component roles, not arbitrary host component names, module paths, or executable render functions. | [[presentation.contract]] |
| content_hierarchy_explicit | invariant | A presentation contract identifies primary task, supporting context, optional detail, and available actions as distinct fields. | [[presentation.contract]] |
| density_bounded | invariant | Presentation density, item count, nesting depth, and content size obey catalog-defined limits. | [[presentation.contract]] |
| response_semantics_preserved | invariant | Host rendering cannot change the declared response schema or action meaning. | [[presentation.contract]] |
| fallback_is_semantic | invariant | When a host lacks a preferred presentation capability, it uses a documented semantically equivalent fallback or returns unsupported. | [[presentation.contract]] |
| untrusted_text_inert | invariant | User- or model-provided text is rendered as inert text and never interpreted as markup or executable content. | [[presentation.contract]] |

| active_interaction_stable | invariant | A host must not reorder, replace, or semantically remap the active response surface during input except for a safety-critical transition or explicit user acceptance. | [[presentation.contract]] |
| adaptation_reason_available | invariant | Material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option. | [[presentation.contract]] |
| uncertainty_semantics_preserved | invariant | Presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities. | [[presentation.contract]] |

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
| validate_presentation | proposed | validated | [[presentation.contract.semantic_role_required]] |
| reject_presentation | proposed | unsupported | ¬([[presentation.contract.semantic_role_required]]) |
| render_with_capabilities | validated | renderable | [[presentation.contract.response_semantics_preserved]] |
| use_semantic_fallback | validated | fallback | [[presentation.contract.fallback_is_semantic]] |
| retire_presentation | renderable | retired | [[presentation.contract.density_bounded]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| semantic_role_required_holds | unit | [[presentation.contract.semantic_role_required]] | `any::<String>()` | `TypeScript conformance test: assert invariant semantic_role_required at its trust boundary and under its stated edge cases.` |
| host_component_names_forbidden_holds | unit | [[presentation.contract.host_component_names_forbidden]] | `any::<String>()` | `TypeScript conformance test: assert invariant host_component_names_forbidden at its trust boundary and under its stated edge cases.` |
| content_hierarchy_explicit_holds | unit | [[presentation.contract.content_hierarchy_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant content_hierarchy_explicit at its trust boundary and under its stated edge cases.` |
| density_bounded_holds | unit | [[presentation.contract.density_bounded]] | `any::<String>()` | `TypeScript conformance test: assert invariant density_bounded at its trust boundary and under its stated edge cases.` |
| response_semantics_preserved_holds | unit | [[presentation.contract.response_semantics_preserved]] | `any::<String>()` | `TypeScript conformance test: assert invariant response_semantics_preserved at its trust boundary and under its stated edge cases.` |
| fallback_is_semantic_holds | unit | [[presentation.contract.fallback_is_semantic]] | `any::<String>()` | `TypeScript conformance test: assert invariant fallback_is_semantic at its trust boundary and under its stated edge cases.` |
| untrusted_text_inert_holds | unit | [[presentation.contract.untrusted_text_inert]] | `any::<String>()` | `TypeScript conformance test: assert invariant untrusted_text_inert at its trust boundary and under its stated edge cases.` |
| mid_input_layout_semantics_stable | unit | [[presentation.contract.active_interaction_stable]] | `any::<String>()` | `Cross-host interaction test: active semantic actions remain stable during entry` |
| p_adaptation_reason_available | unit | [[presentation.contract.adaptation_reason_available]] | `arbitrary_state()` | `material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option` |
| p_uncertainty_semantics_preserved | unit | [[presentation.contract.uncertainty_semantics_preserved]] | `arbitrary_state()` | `presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities` |
