---
id: spec
kind: intent
statement: THE Accessibility Adaptation Layer SHALL preserve interaction semantics while adapting presentation to declared accessibility needs and host capabilities
---

# Accessibility and Adaptive Presentation

Accessibility is a correctness constraint, not a decorative preference. The host adapter maps semantic labels, descriptions, focus order, keyboard navigation, status announcements, and error associations to native mechanisms. When a requested capability cannot be represented accessibly, the adapter must choose a documented equivalent or report that the interaction is unsupported.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| controls_have_names | invariant | Every interactive control has a programmatic name and, when needed, a description and associated error message. | [[spec]] |
| keyboard_equivalent | invariant | Every operation available through pointer input has a keyboard-equivalent operation in hosts that support keyboard input. | [[spec]] |
| focus_order_logical | invariant | Focus order follows the task's semantic reading and action order rather than incidental render order. | [[spec]] |
| status_changes_announced | invariant | Asynchronous completion, validation errors, and important state changes are exposed through the host's appropriate status-announcement mechanism. | [[spec]] |
| meaning_survives_adaptation | invariant | Accessibility adaptation cannot remove required information, change response meaning, or bypass required confirmation. | [[spec]] |
| motion_and_density_respect_preferences | invariant | Presentation respects declared reduced-motion, text-size, and density preferences where the host can support them. | [[spec]] |
| inaccessible_interaction_not_silently_rendered | invariant | If no accessible equivalent exists for a required interaction, the host returns an explicit unsupported result rather than silently rendering an unusable control. | [[spec]] |

| accessibility_obligations_semantic | invariant | Accessibility requirements attach to semantic interaction/contribution obligations before host rendering, not only as post-render checks. | [[spec]] |
| modality_equivalence_explicit | invariant | When exact visual behavior cannot transfer across hosts, the adapter documents a semantically equivalent accessible operation or reports unsupported. | [[spec]] |

## Model
### States
- `proposed`
- `checked`
- `accessible`
- `fallback`
- `unsupported`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| check_accessibility | proposed | checked | [[spec.controls_have_names]] |
| accept_accessible_render | checked | accessible | [[spec.meaning_survives_adaptation]] |
| use_accessible_fallback | checked | fallback | [[spec.keyboard_equivalent]] |
| reject_inaccessible_render | checked | unsupported | ¬([[spec.inaccessible_interaction_not_silently_rendered]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| controls_have_names_holds | unit | [[spec.controls_have_names]] | `any::<String>()` | `TypeScript conformance test: assert invariant controls_have_names at its trust boundary and under its stated edge cases.` |
| keyboard_equivalent_holds | unit | [[spec.keyboard_equivalent]] | `any::<String>()` | `TypeScript conformance test: assert invariant keyboard_equivalent at its trust boundary and under its stated edge cases.` |
| focus_order_logical_holds | unit | [[spec.focus_order_logical]] | `any::<String>()` | `TypeScript conformance test: assert invariant focus_order_logical at its trust boundary and under its stated edge cases.` |
| status_changes_announced_holds | unit | [[spec.status_changes_announced]] | `any::<String>()` | `TypeScript conformance test: assert invariant status_changes_announced at its trust boundary and under its stated edge cases.` |
| meaning_survives_adaptation_holds | unit | [[spec.meaning_survives_adaptation]] | `any::<String>()` | `TypeScript conformance test: assert invariant meaning_survives_adaptation at its trust boundary and under its stated edge cases.` |
| motion_and_density_respect_preferences_holds | unit | [[spec.motion_and_density_respect_preferences]] | `any::<String>()` | `TypeScript conformance test: assert invariant motion_and_density_respect_preferences at its trust boundary and under its stated edge cases.` |
| inaccessible_interaction_not_silently_rendered_holds | unit | [[spec.inaccessible_interaction_not_silently_rendered]] | `any::<String>()` | `TypeScript conformance test: assert invariant inaccessible_interaction_not_silently_rendered at its trust boundary and under its stated edge cases.` |
| accessibility_exists_before_render | unit | [[spec.accessibility_obligations_semantic]] | `any::<String>()` | `Schema test: interaction contract declares obligations consumed by adapters` |
| p_modality_equivalence_explicit | unit | [[spec.modality_equivalence_explicit]] | `arbitrary_state()` | `when exact visual behavior cannot transfer across hosts, the adapter documents a semantically equivalent accessible operation or reports unsupported` |

## Requirements

### Requirement: Accessibility and Adaptive Presentation declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Accessibility and Adaptive Presentation invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.controls_have_names_holds]]
- **VERIFIES** [[spec.keyboard_equivalent_holds]]
- **VERIFIES** [[spec.focus_order_logical_holds]]
- **VERIFIES** [[spec.status_changes_announced_holds]]
- **VERIFIES** [[spec.meaning_survives_adaptation_holds]]
- **VERIFIES** [[spec.motion_and_density_respect_preferences_holds]]
- **VERIFIES** [[spec.inaccessible_interaction_not_silently_rendered_holds]]
- **VERIFIES** [[spec.accessibility_exists_before_render]]
- **VERIFIES** [[spec.p_modality_equivalence_explicit]]

#### Scenario: Violating Accessibility and Adaptive Presentation invariant is rejected

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
