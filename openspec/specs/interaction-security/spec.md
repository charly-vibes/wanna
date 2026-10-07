---
id: spec
kind: intent
statement: THE Interaction Security Boundary SHALL treat agent proposals and host responses as untrusted data until validated against trusted policy and contract definitions
---

# Interaction Security Boundary

The agent may describe a need for human input and propose serializable values. It may not define new executable components, permissions, policy overrides, or authority-bearing actions. The core and host adapters enforce the trusted catalog and revalidate every response.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| agent_content_untrusted | invariant | Agent-authored text, option labels, identifiers, URLs, candidate data, and response suggestions are untrusted until validated and safely rendered. | [[spec]] |
| render_only_allowlisted_kinds | invariant | Only catalog-registered interaction kinds and host-approved component mappings are rendered; strings from an agent never become scripts, handlers, component paths, or raw HTML. | [[spec]] |
| input_limits_enforced | invariant | Payload byte/character size, option count, nesting depth, field lengths, and collection sizes are bounded before expensive parsing or rendering. | [[spec]] |
| permissions_are_host_owned | invariant | Authentication, authorization, approval requirements, and external-effect permissions are determined by trusted host/domain policy, not by an agent proposal or UI state. | [[spec]] |
| links_and_text_are_safe | invariant | Untrusted labels and descriptions are rendered as inert text; URL fields, if a catalog kind permits them, are parsed and checked against an explicit scheme/host policy before use. | [[spec]] |
| event_identity_is_not_trusted_from_ui | invariant | The runtime verifies task/session ownership, active interaction identity, revisions, event deduplication, and authorization context rather than trusting client-supplied identifiers alone. | [[spec]] |
| diagnostics_are_data_minimized | invariant | Rejection diagnostics expose stable reason codes and actionable non-sensitive detail but do not echo secrets, private task data, tokens, or unbounded hostile payloads. | [[spec]] |
| hard_gates_are_not_llm_policy | invariant | Security and authorization hard gates are encoded in trusted code/configuration and cannot be relaxed solely by model-generated rationale, ranking, or contract fields. | [[spec]] |
| payload_passes_security_validation | invariant | A payload reaches validated state only after schema, catalog, size, safe-rendering, and ownership checks all pass. | [[spec]] |
| new_proposal_received | invariant | A rejected proposal may be reconsidered only after a new or corrected payload is received. | [[spec]] |
| interaction_consumed_or_expired | invariant | A validated interaction is retired only after a permitted consume, cancel, supersede, or expiry event. | [[spec]] |

## Model
### States
- `untrusted`
- `validated`
- `rejected`
- `retired`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| accept_validated_payload | untrusted | validated | [[spec.payload_passes_security_validation]] |
| reject_untrusted_payload | untrusted | rejected | ¬([[spec.payload_passes_security_validation]]) |
| resubmit_after_rejection | rejected | untrusted | [[spec.new_proposal_received]] |
| retire_after_use | validated | retired | [[spec.interaction_consumed_or_expired]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| agent_payload_never_executes | unit | [[spec.agent_content_untrusted]] | `any::<String>()` | `Security test: script-like and instruction-like content remains inert data and cannot change policy or tools` |
| unknown_component_is_never_loaded | unit | [[spec.render_only_allowlisted_kinds]] | `any::<String>()` | `Security test: unknown component names cause rejection and no dynamic import or component resolution` |
| oversized_payload_fails_before_render | unit | [[spec.input_limits_enforced]] | `any::<String>()` | `Security test: every configured size/depth/count limit is enforced before rendering; failure is bounded and typed` |
| ui_cannot_authorize_action | unit | [[spec.permissions_are_host_owned]] | `any::<String>()` | `Security test: forged interaction/approval UI events cannot satisfy host/domain authorization` |
| hostile_text_and_urls_are_inert | unit | [[spec.links_and_text_are_safe]] | `any::<String>()` | `Security test: HTML/script text is escaped and disallowed URL schemes/hosts are rejected` |
| spoofed_event_is_rejected | unit | [[spec.event_identity_is_not_trusted_from_ui]] | `any::<String>()` | `Security test: wrong task/session, retired interaction, or stale revision cannot mutate state` |
| diagnostics_do_not_leak_secrets | unit | [[spec.diagnostics_are_data_minimized]] | `any::<String>()` | `Security test: diagnostic output includes reason code but omits configured secret markers and truncates hostile content` |
| agent_cannot_relax_hard_gate | unit | [[spec.hard_gates_are_not_llm_policy]] | `any::<String>()` | `Security test: an agent-proposed override does not change trusted hard-gate outcomes` |
| accepted_payload_passes_all_checks | unit | [[spec.payload_passes_security_validation]] | `any::<String>()` | `Security test: payload cannot reach validated state while any schema/catalog/size/rendering/ownership check fails` |
| rejected_payload_requires_resubmission | unit | [[spec.new_proposal_received]] | `any::<String>()` | `Security test: a rejected payload is not reconsidered without new or corrected input` |
| retirement_requires_lifecycle_event | unit | [[spec.interaction_consumed_or_expired]] | `any::<String>()` | `Security test: validated interaction retires only after a permitted explicit lifecycle event` |

## Requirements

### Requirement: Interaction Security Boundary model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: accept-validated-payload moves `untrusted` to `validated`
- **WHEN** the model is in the `untrusted` state and the `accept_validated_payload` transition guard holds ([[spec.payload_passes_security_validation]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[spec.accepted_payload_passes_all_checks]]

#### Scenario: reject-untrusted-payload moves `untrusted` to `rejected`
- **WHEN** the model is in the `untrusted` state and the `reject_untrusted_payload` transition guard evaluates false (¬([[spec.payload_passes_security_validation]]))
- **THEN** the model enters the `rejected` state and records the transition
- **VERIFIES** [[spec.accepted_payload_passes_all_checks]]

#### Scenario: resubmit-after-rejection moves `rejected` to `untrusted`
- **WHEN** the model is in the `rejected` state and the `resubmit_after_rejection` transition guard holds ([[spec.new_proposal_received]])
- **THEN** the model enters the `untrusted` state and records the transition
- **VERIFIES** [[spec.rejected_payload_requires_resubmission]]

#### Scenario: retire-after-use moves `validated` to `retired`
- **WHEN** the model is in the `validated` state and the `retire_after_use` transition guard holds ([[spec.interaction_consumed_or_expired]])
- **THEN** the model enters the `retired` state and records the transition
- **VERIFIES** [[spec.retirement_requires_lifecycle_event]]

#### Scenario: agent-content-untrusted invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Agent-authored text, option labels, identifiers, URLs, candidate data, and response suggestions are untrusted until validated and safely rendered."
- **VERIFIES** [[spec.agent_payload_never_executes]]

#### Scenario: render-only-allowlisted-kinds invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Only catalog-registered interaction kinds and host-approved component mappings are rendered; strings from an agent never become scripts, handlers, component paths, or raw HTML."
- **VERIFIES** [[spec.unknown_component_is_never_loaded]]

#### Scenario: input-limits-enforced invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Payload byte/character size, option count, nesting depth, field lengths, and collection sizes are bounded before expensive parsing or rendering."
- **VERIFIES** [[spec.oversized_payload_fails_before_render]]

#### Scenario: permissions-are-host-owned invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Authentication, authorization, approval requirements, and external-effect permissions are determined by trusted host/domain policy, not by an agent proposal or UI state."
- **VERIFIES** [[spec.ui_cannot_authorize_action]]

#### Scenario: links-and-text-are-safe invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Untrusted labels and descriptions are rendered as inert text; URL fields, if a catalog kind permits them, are parsed and checked against an explicit scheme/host policy before use."
- **VERIFIES** [[spec.hostile_text_and_urls_are_inert]]

#### Scenario: event-identity-is-not-trusted-from-ui invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "The runtime verifies task/session ownership, active interaction identity, revisions, event deduplication, and authorization context rather than trusting client-supplied identifiers alone."
- **VERIFIES** [[spec.spoofed_event_is_rejected]]

#### Scenario: diagnostics-are-data-minimized invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Rejection diagnostics expose stable reason codes and actionable non-sensitive detail but do not echo secrets, private task data, tokens, or unbounded hostile payloads."
- **VERIFIES** [[spec.diagnostics_do_not_leak_secrets]]

#### Scenario: hard-gates-are-not-llm-policy invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Security and authorization hard gates are encoded in trusted code/configuration and cannot be relaxed solely by model-generated rationale, ranking, or contract fields."
- **VERIFIES** [[spec.agent_cannot_relax_hard_gate]]

#### Scenario: Violating Interaction Security Boundary invariant is rejected

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
