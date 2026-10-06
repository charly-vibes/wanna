---
id: host.adapters
kind: intent
statement: THE Host Adapter Layer SHALL preserve host-neutral interaction semantics when rendering and submitting interactions in each supported host
---

# Host Adapter Layer

Adapters translate validated interaction contracts into the capabilities of Pi's TUI, browser-based interfaces, and other terminal/web hosts. They may change layout and control affordances but may not change business meaning, bypass core validation, or confer authorization.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| adapter_uses_shared_contract | invariant | Every adapter consumes the same versioned host-neutral contract and returns the same typed response/event schema. | [[host.adapters]] |
| host_capability_explicit | invariant | Each adapter declares supported catalog kinds and limits; unsupported kinds return an explicit capability result or a registered semantically equivalent fallback. | [[host.adapters]] |
| response_revalidated_by_core | invariant | Every submitted response passes core validation against the active contract and current task/interaction revisions before state mutation. | [[host.adapters]] |
| visual_render_has_no_authority | invariant | Showing, focusing, hiding, or enabling a control does not authorize an action or alter domain/process state. | [[host.adapters]] |
| host_dependencies_confined | invariant | Pi, browser/DOM, and TUI-library imports are confined to their adapter packages; core public types do not expose those dependencies. | [[host.adapters]] |
| semantic_accessibility_preserved | invariant | An adapter provides an accessible path to the same response semantics using its supported input modes, including keyboard-only operation where the host supports input. | [[host.adapters]] |
| unsupported_not_silent | invariant | A requested interaction that cannot be rendered and has no registered equivalent produces an explicit unsupported result; it is never silently dropped or replaced with arbitrary markup. | [[host.adapters]] |
| host_loss_does_not_commit | invariant | Closing a view, losing focus, or disconnecting a host does not imply a response or approval; any resume behavior is governed by the runtime lifecycle. | [[host.adapters]] |
| incoming_contract_valid | invariant | A received interaction uses a valid versioned host-neutral contract before capability discovery or rendering. | [[host.adapters]] |
| requested_kind_supported | invariant | A requested kind is renderable when the adapter supports it directly or has a registered semantically equivalent fallback. | [[host.adapters]] |
| new_compatible_interaction_received | invariant | An unsupported result returns to receipt only after a new interaction or explicit alternate contract is supplied. | [[host.adapters]] |
| new_response_received | invariant | A response rejection returns to receipt only after a new user response is submitted. | [[host.adapters]] |
| interaction_flow_can_continue | invariant | After an accepted response is committed by the core, the adapter may process the next projection or interaction. | [[host.adapters]] |

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
| validate_received_contract | received | capability_checked | [[host.adapters.incoming_contract_valid]] |
| reject_invalid_received_contract | received | invalid_contract | ¬([[host.adapters.incoming_contract_valid]]) |
| render_supported_kind | capability_checked | rendered | [[host.adapters.requested_kind_supported]] |
| report_unsupported_kind | capability_checked | unsupported | ¬([[host.adapters.requested_kind_supported]]) |
| accept_core_valid_response | rendered | accepted | [[host.adapters.response_revalidated_by_core]] |
| reject_core_invalid_response | rendered | rejected_response | ¬([[host.adapters.response_revalidated_by_core]]) |
| retry_with_valid_contract | invalid_contract | received | [[host.adapters.adapter_uses_shared_contract]] |
| select_registered_fallback | unsupported | received | [[host.adapters.new_compatible_interaction_received]] |
| correct_rejected_response | rejected_response | received | [[host.adapters.new_response_received]] |
| continue_after_acceptance | accepted | received | [[host.adapters.interaction_flow_can_continue]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| adapters_emit_equivalent_events | unit | [[host.adapters.adapter_uses_shared_contract]] | `any::<String>()` | `TypeScript test: equivalent answers in web and TUI yield equivalent host-neutral events` |
| unsupported_kind_is_visible | unit | [[host.adapters.unsupported_not_silent]] | `any::<String>()` | `Adapter contract test: unsupported kind returns a visible typed result or a registered semantic fallback` |
| stale_response_is_revalidated | unit | [[host.adapters.response_revalidated_by_core]] | `any::<String>()` | `TypeScript test: client-side validation cannot make a stale response commit` |
| rendering_does_not_grant_authority | unit | [[host.adapters.visual_render_has_no_authority]] | `any::<String>()` | `TypeScript test: render/focus/enable interactions do not mutate authority state or satisfy an approval gate` |
| host_imports_stay_in_adapters | unit | [[host.adapters.host_dependencies_confined]] | `any::<String>()` | `Static dependency test: core package has no forbidden imports or leaked host types` |
| keyboard_flow_preserves_semantics | unit | [[host.adapters.semantic_accessibility_preserved]] | `any::<String>()` | `Adapter test: every required interaction can be completed without a pointer where the host supports keyboard input` |
| host_loss_does_not_invent_answer | unit | [[host.adapters.host_loss_does_not_commit]] | `any::<String>()` | `TypeScript test: disconnect/close/focus loss creates no answer, approval, or domain mutation` |
| invalid_contract_is_rejected | unit | [[host.adapters.adapter_uses_shared_contract]] | `any::<String>()` | `Adapter contract test: malformed host-neutral contracts never reach the renderer` |
| declared_capabilities_are_tested | unit | [[host.adapters.host_capability_explicit]] | `any::<String>()` | `Adapter contract test: declared support matches actual capabilities for every catalog kind` |
| capability_check_uses_supported_kind | unit | [[host.adapters.requested_kind_supported]] | `any::<String>()` | `Adapter contract test: kind renders only when native support or registered semantic fallback exists` |
| rejected_contract_requires_new_input | unit | [[host.adapters.incoming_contract_valid]] | `any::<String>()` | `Adapter contract test: invalid contract is not processed as renderable until a valid new contract arrives` |
| unsupported_requires_alternative | unit | [[host.adapters.new_compatible_interaction_received]] | `any::<String>()` | `Adapter contract test: unsupported state exits only on a new interaction or explicit alternate contract` |
| rejected_response_requires_resubmission | unit | [[host.adapters.new_response_received]] | `any::<String>()` | `Adapter contract test: response rejection requires a new user submission` |
| continuation_requires_accepted_response | unit | [[host.adapters.interaction_flow_can_continue]] | `any::<String>()` | `Adapter contract test: accepted response advances only after the core commit result` |
