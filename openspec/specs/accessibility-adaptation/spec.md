---
id: accessibility.adaptation
kind: intent
statement: THE Accessibility Adaptation Layer SHALL preserve interaction semantics while adapting presentation to declared accessibility needs and host capabilities
---

# Accessibility and Adaptive Presentation

Accessibility is a correctness constraint, not a decorative preference. The host adapter maps semantic labels, descriptions, focus order, keyboard navigation, status announcements, and error associations to native mechanisms. When a requested capability cannot be represented accessibly, the adapter must choose a documented equivalent or report that the interaction is unsupported.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| controls_have_names | invariant | Every interactive control has a programmatic name and, when needed, a description and associated error message. | [[accessibility.adaptation]] |
| keyboard_equivalent | invariant | Every operation available through pointer input has a keyboard-equivalent operation in hosts that support keyboard input. | [[accessibility.adaptation]] |
| focus_order_logical | invariant | Focus order follows the task's semantic reading and action order rather than incidental render order. | [[accessibility.adaptation]] |
| status_changes_announced | invariant | Asynchronous completion, validation errors, and important state changes are exposed through the host's appropriate status-announcement mechanism. | [[accessibility.adaptation]] |
| meaning_survives_adaptation | invariant | Accessibility adaptation cannot remove required information, change response meaning, or bypass required confirmation. | [[accessibility.adaptation]] |
| motion_and_density_respect_preferences | invariant | Presentation respects declared reduced-motion, text-size, and density preferences where the host can support them. | [[accessibility.adaptation]] |
| inaccessible_interaction_not_silently_rendered | invariant | If no accessible equivalent exists for a required interaction, the host returns an explicit unsupported result rather than silently rendering an unusable control. | [[accessibility.adaptation]] |

| accessibility_obligations_semantic | invariant | Accessibility requirements attach to semantic interaction/contribution obligations before host rendering, not only as post-render checks. | [[accessibility.adaptation]] |
| modality_equivalence_explicit | invariant | When exact visual behavior cannot transfer across hosts, the adapter documents a semantically equivalent accessible operation or reports unsupported. | [[accessibility.adaptation]] |

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
| check_accessibility | proposed | checked | [[accessibility.adaptation.controls_have_names]] |
| accept_accessible_render | checked | accessible | [[accessibility.adaptation.meaning_survives_adaptation]] |
| use_accessible_fallback | checked | fallback | [[accessibility.adaptation.keyboard_equivalent]] |
| reject_inaccessible_render | checked | unsupported | ¬([[accessibility.adaptation.inaccessible_interaction_not_silently_rendered]]) |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| controls_have_names_holds | unit | [[accessibility.adaptation.controls_have_names]] | `any::<String>()` | `TypeScript conformance test: assert invariant controls_have_names at its trust boundary and under its stated edge cases.` |
| keyboard_equivalent_holds | unit | [[accessibility.adaptation.keyboard_equivalent]] | `any::<String>()` | `TypeScript conformance test: assert invariant keyboard_equivalent at its trust boundary and under its stated edge cases.` |
| focus_order_logical_holds | unit | [[accessibility.adaptation.focus_order_logical]] | `any::<String>()` | `TypeScript conformance test: assert invariant focus_order_logical at its trust boundary and under its stated edge cases.` |
| status_changes_announced_holds | unit | [[accessibility.adaptation.status_changes_announced]] | `any::<String>()` | `TypeScript conformance test: assert invariant status_changes_announced at its trust boundary and under its stated edge cases.` |
| meaning_survives_adaptation_holds | unit | [[accessibility.adaptation.meaning_survives_adaptation]] | `any::<String>()` | `TypeScript conformance test: assert invariant meaning_survives_adaptation at its trust boundary and under its stated edge cases.` |
| motion_and_density_respect_preferences_holds | unit | [[accessibility.adaptation.motion_and_density_respect_preferences]] | `any::<String>()` | `TypeScript conformance test: assert invariant motion_and_density_respect_preferences at its trust boundary and under its stated edge cases.` |
| inaccessible_interaction_not_silently_rendered_holds | unit | [[accessibility.adaptation.inaccessible_interaction_not_silently_rendered]] | `any::<String>()` | `TypeScript conformance test: assert invariant inaccessible_interaction_not_silently_rendered at its trust boundary and under its stated edge cases.` |
| accessibility_exists_before_render | unit | [[accessibility.adaptation.accessibility_obligations_semantic]] | `any::<String>()` | `Schema test: interaction contract declares obligations consumed by adapters` |
