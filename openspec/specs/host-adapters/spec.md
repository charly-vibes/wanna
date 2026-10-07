---
id: spec
kind: intent
statement: THE Host Adapter Layer SHALL preserve host-neutral interaction semantics when rendering and submitting interactions in each supported host
---

# Host Adapter Layer

Adapters translate validated interaction contracts into the capabilities of Pi's TUI, browser-based interfaces, and other terminal/web hosts. They may change layout and control affordances but may not change business meaning, bypass core validation, or confer authorization.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| adapter_uses_shared_contract | invariant | Every adapter consumes the same versioned host-neutral contract and returns the same typed response/event schema. | [[spec]] |
| host_capability_explicit | invariant | Each adapter declares supported catalog kinds and limits; unsupported kinds return an explicit capability result or a registered semantically equivalent fallback. | [[spec]] |
| response_revalidated_by_core | invariant | Every submitted response passes core validation against the active contract and current task/interaction revisions before state mutation. | [[spec]] |
| visual_render_has_no_authority | invariant | Showing, focusing, hiding, or enabling a control does not authorize an action or alter domain/process state. | [[spec]] |
| host_dependencies_confined | invariant | Pi, browser/DOM, and TUI-library imports are confined to their adapter packages; core public types do not expose those dependencies. | [[spec]] |
| semantic_accessibility_preserved | invariant | An adapter provides an accessible path to the same response semantics using its supported input modes, including keyboard-only operation where the host supports input. | [[spec]] |
| unsupported_not_silent | invariant | A requested interaction that cannot be rendered and has no registered equivalent produces an explicit unsupported result; it is never silently dropped or replaced with arbitrary markup. | [[spec]] |
| host_loss_does_not_commit | invariant | Closing a view, losing focus, or disconnecting a host does not imply a response or approval; any resume behavior is governed by the runtime lifecycle. | [[spec]] |
| incoming_contract_valid | invariant | A received interaction uses a valid versioned host-neutral contract before capability discovery or rendering. | [[spec]] |
| requested_kind_supported | invariant | A requested kind is renderable when the adapter supports it directly or has a registered semantically equivalent fallback. | [[spec]] |
| new_compatible_interaction_received | invariant | An unsupported result returns to receipt only after a new interaction or explicit alternate contract is supplied. | [[spec]] |
| new_response_received | invariant | A response rejection returns to receipt only after a new user response is submitted. | [[spec]] |
| interaction_flow_can_continue | invariant | After an accepted response is committed by the core, the adapter may process the next projection or interaction. | [[spec]] |

## Model
### States
- `received`
- `capability_checked`
- `rendered`
- `accepted`
- `invalid_contract`
- `unsupported`
- `rejected_response`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_received_contract | received | capability_checked | [[spec.incoming_contract_valid]] |
| reject_invalid_received_contract | received | invalid_contract | ¬([[spec.incoming_contract_valid]]) |
| render_supported_kind | capability_checked | rendered | [[spec.requested_kind_supported]] |
| report_unsupported_kind | capability_checked | unsupported | ¬([[spec.requested_kind_supported]]) |
| accept_core_valid_response | rendered | accepted | [[spec.response_revalidated_by_core]] |
| reject_core_invalid_response | rendered | rejected_response | ¬([[spec.response_revalidated_by_core]]) |
| retry_with_valid_contract | invalid_contract | received | [[spec.adapter_uses_shared_contract]] |
| select_registered_fallback | unsupported | received | [[spec.new_compatible_interaction_received]] |
| correct_rejected_response | rejected_response | received | [[spec.new_response_received]] |
| continue_after_acceptance | accepted | received | [[spec.interaction_flow_can_continue]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| adapters_emit_equivalent_events | unit | [[spec.adapter_uses_shared_contract]] | `any::<String>()` | `TypeScript test: equivalent answers in web and TUI yield equivalent host-neutral events` |
| unsupported_kind_is_visible | unit | [[spec.unsupported_not_silent]] | `any::<String>()` | `Adapter contract test: unsupported kind returns a visible typed result or a registered semantic fallback` |
| stale_response_is_revalidated | unit | [[spec.response_revalidated_by_core]] | `any::<String>()` | `TypeScript test: client-side validation cannot make a stale response commit` |
| rendering_does_not_grant_authority | unit | [[spec.visual_render_has_no_authority]] | `any::<String>()` | `TypeScript test: render/focus/enable interactions do not mutate authority state or satisfy an approval gate` |
| host_imports_stay_in_adapters | unit | [[spec.host_dependencies_confined]] | `any::<String>()` | `Static dependency test: core package has no forbidden imports or leaked host types` |
| keyboard_flow_preserves_semantics | unit | [[spec.semantic_accessibility_preserved]] | `any::<String>()` | `Adapter test: every required interaction can be completed without a pointer where the host supports keyboard input` |
| host_loss_does_not_invent_answer | unit | [[spec.host_loss_does_not_commit]] | `any::<String>()` | `TypeScript test: disconnect/close/focus loss creates no answer, approval, or domain mutation` |
| invalid_contract_is_rejected | unit | [[spec.adapter_uses_shared_contract]] | `any::<String>()` | `Adapter contract test: malformed host-neutral contracts never reach the renderer` |
| declared_capabilities_are_tested | unit | [[spec.host_capability_explicit]] | `any::<String>()` | `Adapter contract test: declared support matches actual capabilities for every catalog kind` |
| capability_check_uses_supported_kind | unit | [[spec.requested_kind_supported]] | `any::<String>()` | `Adapter contract test: kind renders only when native support or registered semantic fallback exists` |
| rejected_contract_requires_new_input | unit | [[spec.incoming_contract_valid]] | `any::<String>()` | `Adapter contract test: invalid contract is not processed as renderable until a valid new contract arrives` |
| unsupported_requires_alternative | unit | [[spec.new_compatible_interaction_received]] | `any::<String>()` | `Adapter contract test: unsupported state exits only on a new interaction or explicit alternate contract` |
| rejected_response_requires_resubmission | unit | [[spec.new_response_received]] | `any::<String>()` | `Adapter contract test: response rejection requires a new user submission` |
| continuation_requires_accepted_response | unit | [[spec.interaction_flow_can_continue]] | `any::<String>()` | `Adapter contract test: accepted response advances only after the core commit result` |

## Requirements

### Requirement: Host Adapter Layer declared invariants are observable

Every constraint this specification declares is carried by a deriving property, and the corpus keeps those properties lint-clean and resolvable so the invariant remains checkable on every revision.

#### Scenario: Host Adapter Layer invariants hold on the canonical corpus

- **WHEN** the specification's property set is evaluated against the deployed corpus
- **THEN** every listed property remains lint-clean, derives from its owning constraint, and resolves in the reference graph
- **VERIFIES** [[spec.adapters_emit_equivalent_events]]
- **VERIFIES** [[spec.unsupported_kind_is_visible]]
- **VERIFIES** [[spec.stale_response_is_revalidated]]
- **VERIFIES** [[spec.rendering_does_not_grant_authority]]
- **VERIFIES** [[spec.host_imports_stay_in_adapters]]
- **VERIFIES** [[spec.keyboard_flow_preserves_semantics]]
- **VERIFIES** [[spec.host_loss_does_not_invent_answer]]
- **VERIFIES** [[spec.invalid_contract_is_rejected]]
- **VERIFIES** [[spec.declared_capabilities_are_tested]]
- **VERIFIES** [[spec.capability_check_uses_supported_kind]]
- **VERIFIES** [[spec.rejected_contract_requires_new_input]]
- **VERIFIES** [[spec.unsupported_requires_alternative]]
- **VERIFIES** [[spec.rejected_response_requires_resubmission]]
- **VERIFIES** [[spec.continuation_requires_accepted_response]]

#### Scenario: Violating Host Adapter Layer invariant is rejected

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
