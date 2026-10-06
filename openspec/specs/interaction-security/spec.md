---
id: interaction.security
kind: intent
statement: THE Interaction Security Boundary SHALL treat agent proposals and host responses as untrusted data until validated against trusted policy and contract definitions
---

# Interaction Security Boundary

The agent may describe a need for human input and propose serializable values. It may not define new executable components, permissions, policy overrides, or authority-bearing actions. The core and host adapters enforce the trusted catalog and revalidate every response.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| agent_content_untrusted | invariant | Agent-authored text, option labels, identifiers, URLs, candidate data, and response suggestions are untrusted until validated and safely rendered. | [[interaction.security]] |
| render_only_allowlisted_kinds | invariant | Only catalog-registered interaction kinds and host-approved component mappings are rendered; strings from an agent never become scripts, handlers, component paths, or raw HTML. | [[interaction.security]] |
| input_limits_enforced | invariant | Payload byte/character size, option count, nesting depth, field lengths, and collection sizes are bounded before expensive parsing or rendering. | [[interaction.security]] |
| permissions_are_host_owned | invariant | Authentication, authorization, approval requirements, and external-effect permissions are determined by trusted host/domain policy, not by an agent proposal or UI state. | [[interaction.security]] |
| links_and_text_are_safe | invariant | Untrusted labels and descriptions are rendered as inert text; URL fields, if a catalog kind permits them, are parsed and checked against an explicit scheme/host policy before use. | [[interaction.security]] |
| event_identity_is_not_trusted_from_ui | invariant | The runtime verifies task/session ownership, active interaction identity, revisions, event deduplication, and authorization context rather than trusting client-supplied identifiers alone. | [[interaction.security]] |
| diagnostics_are_data_minimized | invariant | Rejection diagnostics expose stable reason codes and actionable non-sensitive detail but do not echo secrets, private task data, tokens, or unbounded hostile payloads. | [[interaction.security]] |
| hard_gates_are_not_llm_policy | invariant | Security and authorization hard gates are encoded in trusted code/configuration and cannot be relaxed solely by model-generated rationale, ranking, or contract fields. | [[interaction.security]] |
| payload_passes_security_validation | invariant | A payload reaches validated state only after schema, catalog, size, safe-rendering, and ownership checks all pass. | [[interaction.security]] |
| new_proposal_received | invariant | A rejected proposal may be reconsidered only after a new or corrected payload is received. | [[interaction.security]] |
| interaction_consumed_or_expired | invariant | A validated interaction is retired only after a permitted consume, cancel, supersede, or expiry event. | [[interaction.security]] |

## Model
### States
- `untrusted`
- `validated`
- `rejected`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| accept_validated_payload | untrusted | validated | [[interaction.security.payload_passes_security_validation]] |
| reject_untrusted_payload | untrusted | rejected | ¬([[interaction.security.payload_passes_security_validation]]) |
| resubmit_after_rejection | rejected | untrusted | [[interaction.security.new_proposal_received]] |
| retire_after_use | validated | retired | [[interaction.security.interaction_consumed_or_expired]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| agent_payload_never_executes | unit | [[interaction.security.agent_content_untrusted]] | `any::<String>()` | `Security test: script-like and instruction-like content remains inert data and cannot change policy or tools` |
| unknown_component_is_never_loaded | unit | [[interaction.security.render_only_allowlisted_kinds]] | `any::<String>()` | `Security test: unknown component names cause rejection and no dynamic import or component resolution` |
| oversized_payload_fails_before_render | unit | [[interaction.security.input_limits_enforced]] | `any::<String>()` | `Security test: every configured size/depth/count limit is enforced before rendering; failure is bounded and typed` |
| ui_cannot_authorize_action | unit | [[interaction.security.permissions_are_host_owned]] | `any::<String>()` | `Security test: forged interaction/approval UI events cannot satisfy host/domain authorization` |
| hostile_text_and_urls_are_inert | unit | [[interaction.security.links_and_text_are_safe]] | `any::<String>()` | `Security test: HTML/script text is escaped and disallowed URL schemes/hosts are rejected` |
| spoofed_event_is_rejected | unit | [[interaction.security.event_identity_is_not_trusted_from_ui]] | `any::<String>()` | `Security test: wrong task/session, retired interaction, or stale revision cannot mutate state` |
| diagnostics_do_not_leak_secrets | unit | [[interaction.security.diagnostics_are_data_minimized]] | `any::<String>()` | `Security test: diagnostic output includes reason code but omits configured secret markers and truncates hostile content` |
| agent_cannot_relax_hard_gate | unit | [[interaction.security.hard_gates_are_not_llm_policy]] | `any::<String>()` | `Security test: an agent-proposed override does not change trusted hard-gate outcomes` |
| accepted_payload_passes_all_checks | unit | [[interaction.security.payload_passes_security_validation]] | `any::<String>()` | `Security test: payload cannot reach validated state while any schema/catalog/size/rendering/ownership check fails` |
| rejected_payload_requires_resubmission | unit | [[interaction.security.new_proposal_received]] | `any::<String>()` | `Security test: a rejected payload is not reconsidered without new or corrected input` |
| retirement_requires_lifecycle_event | unit | [[interaction.security.interaction_consumed_or_expired]] | `any::<String>()` | `Security test: validated interaction retires only after a permitted explicit lifecycle event` |
