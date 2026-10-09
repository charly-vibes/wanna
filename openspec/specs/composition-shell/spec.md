# composition-shell Specification

## Purpose
TBD - created by archiving change add-composition-shell. Update Purpose after archive.
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

### Requirement: Projection carries authoritative versions

The shell SHALL expose in every projection the authoritative aggregate version
that the consumer's next conditional commit through the port must expect.

#### Scenario: projection carries authoritative version
- **WHEN** a consumer reads the projection after any applied operation
- **THEN** the projection's aggregateVersion equals the authoritative version the next conditional commit must expect
- **VERIFIES** [[composition.shell.projection_carries_authoritative_version]]

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

