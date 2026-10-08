---
id: composition.shell
kind: intent
statement: THE Composition Shell SHALL compose need normalization, engine evaluation, runtime reduction, and projection into one host-neutral pipeline that mutates committed state only through a consumer-declared persistence port
---

# Composition Shell

The shell is the library's public entry point. It orchestrates the existing layer
barrels (session-state, interaction-need, interaction-engine, interaction-runtime)
into a single evaluation-to-commit pipeline and returns decision data, projections,
and typed outcomes for resumable artifact review. It owns documented boundary
conversions; domain rules remain owned by their existing capability specs.
Behavioral conformance tests exercise those rules across the composed public
barrels. Review completion grants no authorization and triggers no external action. A context the need layer
cannot normalize surfaces as that layer's typed refusal, passed through the shell
unchanged before any evaluation occurs. Host bindings (DOM, TUI, transport) live outside the shell module,
and the shell's public surface is versioned with explicit compatibility decisions.

## Constraints

| id | kind | expr | traces_to |
|---|---|---|---|
| shell_single_entry | invariant | The shell exposes one public entry point that composes session-state handling, need normalization, engine evaluation, runtime reduction, and projection; composing the pipeline requires no import of any layer's internals. | [[composition.shell]] |
| port_required_declared | invariant | Every shell instance is constructed with an explicitly declared persistence port carrying its deduplication scope; no implicit default port exists. | [[composition.shell]] |
| need_normalized_before_evaluation | invariant | The shell evaluates only contexts whose normalized need validated through the interaction-need layer, with task identity, revision, and available catalog version present. | [[composition.shell]] |
| evaluation_versions_pinned | invariant | Each shell evaluation uses exactly one immutable policy version and one immutable interaction-catalog version and includes both versions in its decision result. | [[composition.shell]] |
| commit_through_declared_port | invariant | The shell mutates committed state only through the declared persistence port, committing accepted state changes and replay records atomically when the port supports it; otherwise the consumer declares and tests the port's weaker failure semantics and the shell never claims durable exactly-once processing. | [[composition.shell]] |
| port_failure_semantics_declared | invariant | When the declared port does not support atomic commit and replay, the shell records the port's declared weaker failure semantics and surfaces them in its public result types rather than silently assuming durability. | [[composition.shell]] |
| event_preconditions_current | invariant | A submitted event commits only after core validation confirms current task and interaction revisions and a not-yet-applied event ID within the port's deduplication scope. | [[composition.shell]] |
| projection_derived_not_authoritative | invariant | Projections the shell hands to hosts are derived views that cannot mutate committed or authority state; rendering grants no authorization. | [[composition.shell]] |
| refresh_requires_new_snapshot | invariant | After a state-precondition rejection the shell retries only when a refreshed committed-state snapshot is received. | [[composition.shell]] |
| retirement_explicit | invariant | The shell retires an active interaction only on an explicit retire, cancel, supersede, or expire command permitted for that interaction kind. | [[composition.shell]] |
| host_binding_confined | invariant | Host bindings for DOM, TUI, and transport live in separate consumer or adapter modules; the shell public types and transitive dependencies expose no host or transport types. Packaging may later isolate those modules further. | [[composition.shell]] |
| shell_surface_versioned | invariant | The shell's public surface carries a semantic version, and a revision that changes input, output, or effect semantics ships with an explicit compatibility decision and migration note. | [[composition.shell]] |
| review_mapping_explicit | invariant | The shell accepts only review_artifact needs mapped by trusted policy/catalog to runtime review; task and interaction revisions are nonnegative safe integers with exact canonical decimal conversions to string-based layers; unsupported mappings are typed refusals. | [[composition.shell]] |
| policy_eligibility_composed | invariant | The shell normalizes raw need proposals and runs the interaction-policy eligibility gates before engine evaluation, preserving recommendation order, exclusions and provenance; an empty eligible set returns no_candidate and creates no interaction. | [[composition.shell]] |
| decision_freshness_atomic | invariant | Initial decision commit checks its evaluated task revision against authoritative state in the same conditional storage transaction that commits the decision; a stale decision never creates an active interaction. | [[composition.shell]] |
| shared_commit_conditional | invariant | For an atomic declared port, state, replay and operation receipts commit together after storage-level expected-version and revision checks; distinct operations from two shell instances sharing one base version cannot both commit; operation identity is deduplicated across restart within the declared scope. | [[composition.shell]] |
| decision_provenance_durable | invariant | Decision provenance retains proposal identity, evidence references, normalizer identity, exclusions and evaluation policy/catalog/taxonomy/shell versions through commit, projection and reload; runtime contract/schema/reducer policy identities remain separately named. | [[composition.shell]] |
| uncertain_effect_blocks_mutation | invariant | An unknown commit effect blocks further mutation, including after shell reconstruction, until authoritative reconciliation proves application or non-application; absent receipts without such proof do not authorize retry. | [[composition.shell]] |
| continuity_restored | invariant | Reopening from a compatible authoritative snapshot restores completed, pending, changed and unresolved review state bound to the original artifact revision; incompatible or corrupt storage yields recovery_required without overwriting it. | [[composition.shell]] |
| review_completion_recorded | invariant | A valid review response and its explicit permitted retirement update runtime, session completion and replay in one declared-port transaction; completion grants no authority and emits no external action. | [[composition.shell]] |

## Model

### States
- `assembled`
- `normalized`
- `decided`
- `committed`
- `projected`
- `rejected_event`
- `retired`
- `uncertain_commit`

Normalization refusals, unsupported inputs, empty decisions and certain-no-effect
port failures leave the source state unchanged and return typed outcomes. Projection
is observational; projected and committed retain the same authoritative snapshot.
Reconciliation restores the authoritative active or retired state when applied, or
returns to assembled for reload and reevaluation when non-application is proven.
A restored retired interaction cannot accept further responses.

### Transitions
| id | from | to | guard |
|---|---|---|---|
| normalize_need | assembled | normalized | [[composition.shell.need_normalized_before_evaluation]] |
| evaluate_pinned_decision | normalized | decided | [[composition.shell.evaluation_versions_pinned]] |
| commit_declared_decision | decided | committed | [[composition.shell.commit_through_declared_port]] ∧ [[composition.shell.decision_freshness_atomic]] |
| project_committed_state | committed | projected | [[composition.shell.projection_derived_not_authoritative]] |
| apply_current_event | projected | committed | [[composition.shell.event_preconditions_current]] |
| reject_current_event | projected | rejected_event | ¬([[composition.shell.event_preconditions_current]]) |
| retry_after_state_refresh | rejected_event | projected | [[composition.shell.refresh_requires_new_snapshot]] |
| retire_shell_interaction | committed | retired | [[composition.shell.retirement_explicit]] |
| retire_projected_interaction | projected | retired | [[composition.shell.retirement_explicit]] |
| complete_review | projected | retired | [[composition.shell.review_completion_recorded]] |
| record_uncertain_commit | committed | uncertain_commit | [[composition.shell.uncertain_effect_blocks_mutation]] |
| record_uncertain_response | projected | uncertain_commit | [[composition.shell.uncertain_effect_blocks_mutation]] |
| record_uncertain_decision | decided | uncertain_commit | [[composition.shell.uncertain_effect_blocks_mutation]] |
| reconcile_applied_commit | uncertain_commit | committed | [[composition.shell.uncertain_effect_blocks_mutation]] and authoritative receipt proves application to an active interaction |
| reconcile_applied_completion | uncertain_commit | retired | [[composition.shell.uncertain_effect_blocks_mutation]] and authoritative receipt proves completed or retired interaction |
| reconcile_no_effect | uncertain_commit | assembled | [[composition.shell.uncertain_effect_blocks_mutation]] and authoritative proof of non-application permits reload and reevaluation |
| resume_committed_review | assembled | committed | [[composition.shell.continuity_restored]] |
| resume_retired_review | assembled | retired | [[composition.shell.continuity_restored]] |
| reevaluate_after_refresh | rejected_event | normalized | [[composition.shell.refresh_requires_new_snapshot]] |

## Properties

| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| single_entry_no_internals | unit | [[composition.shell.shell_single_entry]] | `any::<String>()` | `TypeScript test: the full pipeline runs through the shell entry point and the src import graph gains no cross-layer internal imports` |
| port_is_constructor_required | unit | [[composition.shell.port_required_declared]] | `any::<String>()` | `TypeScript test: constructing the shell without a declared persistence port and deduplication scope is rejected` |
| only_normalized_contexts_evaluate | unit | [[composition.shell.need_normalized_before_evaluation]] | `any::<String>()` | `TypeScript test: a context carrying a malformed or un-normalized need is refused before engine evaluation` |
| pinned_versions_in_result | unit | [[composition.shell.evaluation_versions_pinned]] | `any::<String>()` | `TypeScript test: decision results expose the exact policy and catalog versions used` |
| commits_only_via_port | unit | [[composition.shell.commit_through_declared_port]] | `any::<String>()` | `TypeScript test: state mutation attempts that bypass the declared port leave committed state and replay log unchanged` |
| stale_event_typed_rejection | unit | [[composition.shell.event_preconditions_current]] | `any::<String>()` | `TypeScript test: a stale-revision or duplicate event returns a typed rejection and leaves committed state unchanged` |
| projection_mutation_is_inert | unit | [[composition.shell.projection_derived_not_authoritative]] | `any::<String>()` | `TypeScript test: mutating a projection copy never changes committed or authority state` |
| retry_requires_refresh | unit | [[composition.shell.refresh_requires_new_snapshot]] | `any::<String>()` | `TypeScript test: retry after state-precondition rejection is refused until a refreshed snapshot arrives` |
| retire_only_explicit | unit | [[composition.shell.retirement_explicit]] | `any::<String>()` | `TypeScript test: cancellation, expiry, supersession, and retirement occur only on their explicit commands` |
| no_host_types_in_shell | unit | [[composition.shell.host_binding_confined]] | `any::<String>()` | `Static dependency test: the shell module public types and transitive imports contain no DOM, TUI, or transport dependencies` |
| surface_version_changes_declared | unit | [[composition.shell.shell_surface_versioned]] | `any::<String>()` | `Release test: a semantic surface change ships with a recorded compatibility decision and migration note` |
| port_failure_semantics_tested | unit | [[composition.shell.port_failure_semantics_declared]] | `any::<String>()` | `TypeScript test: injected failure at every shell commit boundary obeys the declared atomic or weaker recovery contract without silent double application` |
| review_mapping_checked | unit | [[composition.shell.review_mapping_explicit]] | `any::<String>()` | `TypeScript test: unsupported mapping or noncanonical revision is refused without state mutation` |
| policy_gates_preserved | unit | [[composition.shell.policy_eligibility_composed]] | `any::<String>()` | `TypeScript test: an excluded candidate cannot become a committed review and an empty set produces no active interaction` |
| stale_decision_refused | unit | [[composition.shell.decision_freshness_atomic]] | `any::<String>()` | `TypeScript test: revision 7 evaluation followed by revision 8 update cannot commit a revision 7 decision as current` |
| shared_writers_serialized | unit | [[composition.shell.shared_commit_conditional]] | `any::<String>()` | `TypeScript test: two independent shells sharing storage produce one applied response and one conflict, and replaying the winner after restart makes no second mutation` |
| provenance_survives_reload | unit | [[composition.shell.decision_provenance_durable]] | `any::<String>()` | `TypeScript test: reload preserves exact evaluation pins and evidence while distinguishing runtime policy identity and absent evidence` |
| unknown_commit_reconciled | unit | [[composition.shell.uncertain_effect_blocks_mutation]] | `any::<String>()` | `TypeScript test: a committed response with lost acknowledgement is reconciled after reconstruction without double application` |
| review_resume_restored | unit | [[composition.shell.continuity_restored]] | `any::<String>()` | `TypeScript test: restart restores review history and revision binding, and incompatible storage is preserved with a typed recovery result` |
| review_completion_atomic | unit | [[composition.shell.review_completion_recorded]] | `any::<String>()` | `TypeScript test: one response completes its review and session record atomically without authorization or external effects` |

## Purpose

Provide a public surface for the artifact-review slice of the corpus: one entry point for the evaluation-to-commit pipeline, a forced
persistence port declaration, and a host-neutral, versioned API that agents, host
adapters, and the workbench SPA can consume.

## ADDED Requirements

### Requirement: Single entry-point composition

The pipeline SHALL be reachable through one public shell entry point that composes
session-state handling, need normalization, engine evaluation, runtime reduction,
and projection, without importing any layer's internals.

#### Scenario: full pipeline via the shell
- **WHEN** a consumer constructs the shell with a session, a policy, a catalog, and a declared persistence port
- **THEN** need normalization, engine evaluation, commit, and projection all execute through the single entry point
- **VERIFIES** [[composition.shell.single_entry_no_internals]]

#### Scenario: composition without layer internals
- **WHEN** the src import graph is inspected after composition is achievable via the shell
- **THEN** no layer imports another layer's internals
- **VERIFIES** [[composition.shell.single_entry_no_internals]]

### Requirement: Declared persistence port

The shell SHALL be constructible only with an explicitly declared persistence port
carrying its deduplication scope, SHALL mutate committed state only through
that port, and SHALL honor the port's declared failure semantics — atomic when
supported, explicitly declared weaker semantics otherwise, never silently claiming
durable exactly-once processing.

#### Scenario: construction without a port is rejected
- **WHEN** a consumer attempts to construct the shell without a declared persistence port and deduplication scope
- **THEN** construction is rejected before any evaluation occurs
- **VERIFIES** [[composition.shell.port_is_constructor_required]]

#### Scenario: mutation bypassing the port changes nothing
- **WHEN** a state mutation attempt bypasses the declared port
- **THEN** committed state and the replay log remain unchanged
- **VERIFIES** [[composition.shell.commits_only_via_port]]

#### Scenario: commit failure obeys declared semantics
- **WHEN** an injected failure occurs at every shell commit boundary on a port that does not support atomic commit and replay
- **THEN** the outcome obeys the declared weaker failure semantics with no silent double application, and the shell's public result types surface the declared semantics
- **VERIFIES** [[composition.shell.port_failure_semantics_tested]]

### Requirement: Pinned evaluation and current-event commits

The shell SHALL evaluate only normalized contexts under exactly one immutable policy
version and one immutable interaction-catalog version, and SHALL commit a submitted
event only after core validation confirms current revisions and an unused event ID.

#### Scenario: un-normalized need refused before evaluation
- **WHEN** a context carries a malformed or un-normalized need
- **THEN** the shell refuses it before engine evaluation
- **VERIFIES** [[composition.shell.only_normalized_contexts_evaluate]]

#### Scenario: decision result carries pinned versions
- **WHEN** the engine evaluates a normalized context
- **THEN** the decision result exposes the exact policy and catalog versions used
- **VERIFIES** [[composition.shell.pinned_versions_in_result]]

#### Scenario: stale event returns typed rejection
- **WHEN** a submitted event carries a stale revision or a duplicate event ID
- **THEN** the shell returns a typed rejection and leaves committed state unchanged
- **VERIFIES** [[composition.shell.stale_event_typed_rejection]]

### Requirement: Derived projections and explicit retirement

The shell SHALL hand hosts only derived projections that cannot mutate committed or
authority state, and SHALL retire an active interaction only on an explicit
retire, cancel, supersede, or expire command permitted for that interaction kind.

#### Scenario: projection mutation is inert
- **WHEN** a consumer mutates a projection copy handed to a host
- **THEN** committed and authority state are unchanged
- **VERIFIES** [[composition.shell.projection_mutation_is_inert]]

#### Scenario: retirement only on explicit command
- **WHEN** cancellation, expiry, supersession, or retirement is requested
- **THEN** the interaction retires only through its explicit permitted command
- **VERIFIES** [[composition.shell.retire_only_explicit]]

#### Scenario: retry requires refreshed snapshot
- **WHEN** a state-precondition rejection occurred and a retry is attempted without a refreshed committed-state snapshot
- **THEN** the retry is refused until the snapshot arrives
- **VERIFIES** [[composition.shell.retry_requires_refresh]]

### Requirement: Host-neutral versioned surface

The shell's public surface SHALL carry a semantic version, SHALL expose no host or
transport types, and SHALL ship an explicit compatibility decision and migration
note with any revision that changes input, output, or effect semantics.

#### Scenario: no host imports in the shell module
- **WHEN** the shell module's public types and transitive dependencies are statically inspected
- **THEN** no DOM, TUI, or transport imports are declared
- **VERIFIES** [[composition.shell.no_host_types_in_shell]]

#### Scenario: surface change ships a compatibility decision
- **WHEN** a revision changes the shell's input, output, or effect semantics
- **THEN** the release carries a recorded compatibility decision and migration note
- **VERIFIES** [[composition.shell.surface_version_changes_declared]]

### Requirement: Review boundary mappings

The shell SHALL enforce the documented review-only kind mapping and lossless revision conversions.

#### Scenario: unsupported boundary representation
- **WHEN** a consumer supplies a non-review kind or a noncanonical or unsafe revision
- **THEN** the shell returns a typed refusal and leaves committed state unchanged
- **VERIFIES** [[composition.shell.review_mapping_checked]]

### Requirement: Composed policy eligibility

The shell SHALL evaluate normalized needs through trusted catalog and policy eligibility before engine evaluation and preserve the resulting ranking, exclusions and provenance.

#### Scenario: excluded or empty candidates
- **WHEN** policy excludes a candidate or returns zero eligible candidates
- **THEN** the excluded candidate cannot commit and an empty decision returns no_candidate without creating an interaction
- **VERIFIES** [[composition.shell.policy_gates_preserved]]

### Requirement: Current initial decision

The shell SHALL check evaluated task freshness atomically at initial decision commit.

#### Scenario: artifact changes before decision commit
- **WHEN** revision 7 is evaluated and revision 8 becomes authoritative before commit
- **THEN** the old decision is rejected as stale and creates no active review
- **VERIFIES** [[composition.shell.stale_decision_refused]]

### Requirement: Shared storage commits

The shell SHALL require storage-level conditional state, replay and receipt commits from an atomic port and deduplicate operation identities across shell reconstruction within its declared scope.

#### Scenario: independent writers share a base revision
- **WHEN** two independent shells sharing one atomic port submit distinct responses from the same aggregate version
- **THEN** exactly one applies and the other receives a typed conflict with no second completion
- **VERIFIES** [[composition.shell.shared_writers_serialized]]

#### Scenario: duplicate after restart
- **WHEN** an already recorded response ID is delivered after shell reconstruction
- **THEN** the shell returns a typed duplicate correlated with its stored receipt and makes no second state mutation
- **VERIFIES** [[composition.shell.shared_writers_serialized]]

### Requirement: Durable decision provenance

The shell SHALL preserve decision evidence and evaluation version identities through persistence and resume while naming runtime version identities separately.

#### Scenario: reload retains evaluation evidence
- **WHEN** a committed review is projected and reopened from storage
- **THEN** its proposal, evidence, exclusions and evaluation versions are preserved separately from runtime versions and empty evidence is distinguishable
- **VERIFIES** [[composition.shell.provenance_survives_reload]]

### Requirement: Uncertain commit reconciliation

The shell SHALL block further mutation after an uncertain commit until authoritative reconciliation establishes application or non-application, including across reconstruction.

#### Scenario: acknowledgement lost after durable write
- **WHEN** a response commits in storage but its acknowledgement is lost and the shell is reconstructed
- **THEN** the pending operation remains identifiable, mutation is blocked until reconciliation, and the committed response is not applied twice
- **VERIFIES** [[composition.shell.unknown_commit_reconciled]]

### Requirement: Review continuity

The shell SHALL restore revision-bound review continuity from compatible storage and return recovery_required without overwriting incompatible or corrupt storage.

#### Scenario: restart restores the review
- **WHEN** the shell is destroyed and reopened using the same durable store
- **THEN** completed, pending, changed and unresolved reviews retain their original revisions and provenance
- **VERIFIES** [[composition.shell.review_resume_restored]]

#### Scenario: incompatible stored version
- **WHEN** storage contains an unsupported schema or corrupt replay
- **THEN** the shell returns recovery_required and preserves the stored data
- **VERIFIES** [[composition.shell.review_resume_restored]]

### Requirement: Recorded review completion

The shell SHALL record response, explicit retirement and session completion through one declared-port transaction without granting authorization or executing an external action.

#### Scenario: feedback completes review
- **WHEN** valid feedback is submitted for a current projected review
- **THEN** one completed review, its replay transitions and session completion are persisted with no authority grant or external action
- **VERIFIES** [[composition.shell.review_completion_atomic]]

## Requirements

### Requirement: Single entry-point composition

The pipeline SHALL be reachable through one public shell entry point that composes
session-state handling, need normalization, engine evaluation, runtime reduction,
and projection, without importing any layer's internals.

#### Scenario: full pipeline via the shell
- **WHEN** a consumer constructs the shell with a session, a policy, a catalog, and a declared persistence port
- **THEN** need normalization, engine evaluation, commit, and projection all execute through the single entry point
- **VERIFIES** [[composition.shell.single_entry_no_internals]]

#### Scenario: composition without layer internals
- **WHEN** the src import graph is inspected after composition is achievable via the shell
- **THEN** no layer imports another layer's internals
- **VERIFIES** [[composition.shell.single_entry_no_internals]]

### Requirement: Declared persistence port

The shell SHALL be constructible only with an explicitly declared persistence port
carrying its deduplication scope, SHALL mutate committed state only through
that port, and SHALL honor the port's declared failure semantics — atomic when
supported, explicitly declared weaker semantics otherwise, never silently claiming
durable exactly-once processing.

#### Scenario: construction without a port is rejected
- **WHEN** a consumer attempts to construct the shell without a declared persistence port and deduplication scope
- **THEN** construction is rejected before any evaluation occurs
- **VERIFIES** [[composition.shell.port_is_constructor_required]]

#### Scenario: mutation bypassing the port changes nothing
- **WHEN** a state mutation attempt bypasses the declared port
- **THEN** committed state and the replay log remain unchanged
- **VERIFIES** [[composition.shell.commits_only_via_port]]

#### Scenario: commit failure obeys declared semantics
- **WHEN** an injected failure occurs at every shell commit boundary on a port that does not support atomic commit and replay
- **THEN** the outcome obeys the declared weaker failure semantics with no silent double application, and the shell's public result types surface the declared semantics
- **VERIFIES** [[composition.shell.port_failure_semantics_tested]]

### Requirement: Pinned evaluation and current-event commits

The shell SHALL evaluate only normalized contexts under exactly one immutable policy
version and one immutable interaction-catalog version, and SHALL commit a submitted
event only after core validation confirms current revisions and an unused event ID.

#### Scenario: un-normalized need refused before evaluation
- **WHEN** a context carries a malformed or un-normalized need
- **THEN** the shell refuses it before engine evaluation
- **VERIFIES** [[composition.shell.only_normalized_contexts_evaluate]]

#### Scenario: decision result carries pinned versions
- **WHEN** the engine evaluates a normalized context
- **THEN** the decision result exposes the exact policy and catalog versions used
- **VERIFIES** [[composition.shell.pinned_versions_in_result]]

#### Scenario: stale event returns typed rejection
- **WHEN** a submitted event carries a stale revision or a duplicate event ID
- **THEN** the shell returns a typed rejection and leaves committed state unchanged
- **VERIFIES** [[composition.shell.stale_event_typed_rejection]]

### Requirement: Derived projections and explicit retirement

The shell SHALL hand hosts only derived projections that cannot mutate committed or
authority state, and SHALL retire an active interaction only on an explicit
retire, cancel, supersede, or expire command permitted for that interaction kind.

#### Scenario: projection mutation is inert
- **WHEN** a consumer mutates a projection copy handed to a host
- **THEN** committed and authority state are unchanged
- **VERIFIES** [[composition.shell.projection_mutation_is_inert]]

#### Scenario: retirement only on explicit command
- **WHEN** cancellation, expiry, supersession, or retirement is requested
- **THEN** the interaction retires only through its explicit permitted command
- **VERIFIES** [[composition.shell.retire_only_explicit]]

#### Scenario: retry requires refreshed snapshot
- **WHEN** a state-precondition rejection occurred and a retry is attempted without a refreshed committed-state snapshot
- **THEN** the retry is refused until the snapshot arrives
- **VERIFIES** [[composition.shell.retry_requires_refresh]]

### Requirement: Host-neutral versioned surface

The shell's public surface SHALL carry a semantic version, SHALL expose no host or
transport types, and SHALL ship an explicit compatibility decision and migration
note with any revision that changes input, output, or effect semantics.

#### Scenario: no host imports in the shell module
- **WHEN** the shell module's public types and transitive dependencies are statically inspected
- **THEN** no DOM, TUI, or transport imports are declared
- **VERIFIES** [[composition.shell.no_host_types_in_shell]]

#### Scenario: surface change ships a compatibility decision
- **WHEN** a revision changes the shell's input, output, or effect semantics
- **THEN** the release carries a recorded compatibility decision and migration note
- **VERIFIES** [[composition.shell.surface_version_changes_declared]]

### Requirement: Review boundary mappings

The shell SHALL enforce the documented review-only kind mapping and lossless revision conversions.

#### Scenario: unsupported boundary representation
- **WHEN** a consumer supplies a non-review kind or a noncanonical or unsafe revision
- **THEN** the shell returns a typed refusal and leaves committed state unchanged
- **VERIFIES** [[composition.shell.review_mapping_checked]]

### Requirement: Composed policy eligibility

The shell SHALL evaluate normalized needs through trusted catalog and policy eligibility before engine evaluation and preserve the resulting ranking, exclusions and provenance.

#### Scenario: excluded or empty candidates
- **WHEN** policy excludes a candidate or returns zero eligible candidates
- **THEN** the excluded candidate cannot commit and an empty decision returns no_candidate without creating an interaction
- **VERIFIES** [[composition.shell.policy_gates_preserved]]

### Requirement: Current initial decision

The shell SHALL check evaluated task freshness atomically at initial decision commit.

#### Scenario: artifact changes before decision commit
- **WHEN** revision 7 is evaluated and revision 8 becomes authoritative before commit
- **THEN** the old decision is rejected as stale and creates no active review
- **VERIFIES** [[composition.shell.stale_decision_refused]]

### Requirement: Shared storage commits

The shell SHALL require storage-level conditional state, replay and receipt commits from an atomic port and deduplicate operation identities across shell reconstruction within its declared scope.

#### Scenario: independent writers share a base revision
- **WHEN** two independent shells sharing one atomic port submit distinct responses from the same aggregate version
- **THEN** exactly one applies and the other receives a typed conflict with no second completion
- **VERIFIES** [[composition.shell.shared_writers_serialized]]

#### Scenario: duplicate after restart
- **WHEN** an already recorded response ID is delivered after shell reconstruction
- **THEN** the shell returns a typed duplicate correlated with its stored receipt and makes no second state mutation
- **VERIFIES** [[composition.shell.shared_writers_serialized]]

### Requirement: Durable decision provenance

The shell SHALL preserve decision evidence and evaluation version identities through persistence and resume while naming runtime version identities separately.

#### Scenario: reload retains evaluation evidence
- **WHEN** a committed review is projected and reopened from storage
- **THEN** its proposal, evidence, exclusions and evaluation versions are preserved separately from runtime versions and empty evidence is distinguishable
- **VERIFIES** [[composition.shell.provenance_survives_reload]]

### Requirement: Uncertain commit reconciliation

The shell SHALL block further mutation after an uncertain commit until authoritative reconciliation establishes application or non-application, including across reconstruction.

#### Scenario: acknowledgement lost after durable write
- **WHEN** a response commits in storage but its acknowledgement is lost and the shell is reconstructed
- **THEN** the pending operation remains identifiable, mutation is blocked until reconciliation, and the committed response is not applied twice
- **VERIFIES** [[composition.shell.unknown_commit_reconciled]]

### Requirement: Review continuity

The shell SHALL restore revision-bound review continuity from compatible storage and return recovery_required without overwriting incompatible or corrupt storage.

#### Scenario: restart restores the review
- **WHEN** the shell is destroyed and reopened using the same durable store
- **THEN** completed, pending, changed and unresolved reviews retain their original revisions and provenance
- **VERIFIES** [[composition.shell.review_resume_restored]]

#### Scenario: incompatible stored version
- **WHEN** storage contains an unsupported schema or corrupt replay
- **THEN** the shell returns recovery_required and preserves the stored data
- **VERIFIES** [[composition.shell.review_resume_restored]]

### Requirement: Recorded review completion

The shell SHALL record response, explicit retirement and session completion through one declared-port transaction without granting authorization or executing an external action.

#### Scenario: feedback completes review
- **WHEN** valid feedback is submitted for a current projected review
- **THEN** one completed review, its replay transitions and session completion are persisted with no authority grant or external action
- **VERIFIES** [[composition.shell.review_completion_atomic]]
