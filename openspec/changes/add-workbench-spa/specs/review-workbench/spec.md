---
id: spec
kind: intent
statement: THE Review Workbench SHALL let a human complete and resume revision-bound artifact review through the public composition shell
---

# Review Workbench

## Constraints

| id | kind | expr | traces_to |
|---|---|---|---|
| revision_visible | invariant | The workbench SHALL display the exact artifact identity, revision, content and review request associated with the shell projection and record feedback only through the public shell. | [[spec]] |
| stale_feedback_preserved | invariant | The workbench SHALL explain stale responses, preserve unsent feedback as presentation data and require a fresh review before a response can target a changed revision. | [[spec]] |
| durable_adapter_conditional | invariant | The durable workbench adapter SHALL atomically condition state, replay and receipt writes on authoritative revisions and preserve deduplication across independent clients and reconstruction. | [[spec]] |
| resume_visible | invariant | The workbench SHALL restore completed, pending and changed review information on reload and display uncertain or recovery-required outcomes without silently resetting stored state or retrying mutations. | [[spec]] |
| consumer_boundary | invariant | The workbench and headless consumer SHALL use only the shell public interface for policy, lifecycle, revision, deduplication and recovery decisions, with host bindings outside shell dependencies. | [[spec]] |
| reuse_evidence_recorded | invariant | The evaluation SHALL compare the workbench and second consumer with a direct implementation under identical acceptance scenarios and record integration effort, custom coordination and a proceed, revise, narrow or defer decision. | [[spec]] |

## Model

### States
- `ready`
- `reviewing`
- `recorded`
- `changed`
- `recovering`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| open_review | ready | reviewing | [[spec.revision_visible]] |
| record_feedback | reviewing | recorded | [[spec.durable_adapter_conditional]] |
| explain_stale | reviewing | changed | [[spec.stale_feedback_preserved]] |
| review_changed_revision | changed | reviewing | [[spec.stale_feedback_preserved]] |
| reopen_pending | ready | reviewing | [[spec.resume_visible]] |
| reopen_completed | ready | recorded | [[spec.resume_visible]] |
| await_reconciliation | reviewing | recovering | [[spec.resume_visible]] |
| restore_recorded | recovering | recorded | [[spec.resume_visible]] |
| restore_pending | recovering | reviewing | [[spec.resume_visible]] |

## Properties

| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| review_revision_visible | unit | [[spec.revision_visible]] | `any::<String>()` | `Consumer test: the screen shows the recorded feedback tied to revision 7 and no authorization or external action occurs` |
| stale_feedback_explained | unit | [[spec.stale_feedback_preserved]] | `any::<String>()` | `Consumer test: submission is rejected through the shell, the draft remains visible and the reviewer must explicitly review revision 8 before submitting against it` |
| adapter_conflicts_serialized | unit | [[spec.durable_adapter_conditional]] | `any::<String>()` | `Consumer test: one response applies and the other conflicts; reconstruction and duplicate delivery do not create a second completion` |
| resume_outcomes_visible | unit | [[spec.resume_visible]] | `any::<String>()` | `Consumer test: history and original revision survive; uncertain effects block mutation until reconciliation and incompatible data remains preserved` |
| consumer_uses_public_surface | unit | [[spec.consumer_boundary]] | `any::<String>()` | `Consumer test: neither consumer imports layer internals or implements acceptance or recovery rules and the shell has no transitive host dependency` |
| reuse_comparison_complete | unit | [[spec.reuse_evidence_recorded]] | `any::<String>()` | `Consumer test: the report separates initial and marginal effort, discloses familiarity and exclusions, counts consumer coordination and records whether reuse required core changes` |

## Purpose

Deliver the first usable consumer and evidence of reuse for the composition shell.

## ADDED Requirements

### Requirement: Revision visible

The workbench SHALL display the exact artifact identity, revision, content and review request associated with the shell projection and record feedback only through the public shell.

#### Scenario: review revision visible
- **WHEN** a reviewer opens revision 7 and submits valid feedback
- **THEN** the screen shows the recorded feedback tied to revision 7 and no authorization or external action occurs
- **VERIFIES** [[spec.review_revision_visible]]

### Requirement: Stale feedback preserved

The workbench SHALL explain stale responses, preserve unsent feedback as presentation data and require a fresh review before a response can target a changed revision.

#### Scenario: stale feedback explained
- **WHEN** revision 8 replaces revision 7 while feedback is being entered
- **THEN** submission is rejected through the shell, the draft remains visible and the reviewer must explicitly review revision 8 before submitting against it
- **VERIFIES** [[spec.stale_feedback_explained]]

### Requirement: Durable adapter conditional

The durable workbench adapter SHALL atomically condition state, replay and receipt writes on authoritative revisions and preserve deduplication across independent clients and reconstruction.

#### Scenario: adapter conflicts serialized
- **WHEN** two independent clients submit distinct responses from the same stored version
- **THEN** one response applies and the other conflicts; reconstruction and duplicate delivery do not create a second completion
- **VERIFIES** [[spec.adapter_conflicts_serialized]]

### Requirement: Resume visible

The workbench SHALL restore completed, pending and changed review information on reload and display uncertain or recovery-required outcomes without silently resetting stored state or retrying mutations.

#### Scenario: resume outcomes visible
- **WHEN** the page reloads after a normal commit or a commit with lost acknowledgement
- **THEN** history and original revision survive; uncertain effects block mutation until reconciliation and incompatible data remains preserved
- **VERIFIES** [[spec.resume_outcomes_visible]]

### Requirement: Consumer boundary

The workbench and headless consumer SHALL use only the shell public interface for policy, lifecycle, revision, deduplication and recovery decisions, with host bindings outside shell dependencies.

#### Scenario: consumer uses public surface
- **WHEN** consumer dependencies and interaction paths are inspected
- **THEN** neither consumer imports layer internals or implements acceptance or recovery rules and the shell has no transitive host dependency
- **VERIFIES** [[spec.consumer_uses_public_surface]]

### Requirement: Reuse evidence recorded

The evaluation SHALL compare the workbench and second consumer with a direct implementation under identical acceptance scenarios and record integration effort, custom coordination and a proceed, revise, narrow or defer decision.

#### Scenario: reuse comparison complete
- **WHEN** the second consumer and baseline complete the acceptance scenarios
- **THEN** the report separates initial and marginal effort, discloses familiarity and exclusions, counts consumer coordination and records whether reuse required core changes
- **VERIFIES** [[spec.reuse_comparison_complete]]

## Requirements

### Requirement: Revision visible

The workbench SHALL display the exact artifact identity, revision, content and review request associated with the shell projection and record feedback only through the public shell.

#### Scenario: review revision visible
- **WHEN** a reviewer opens revision 7 and submits valid feedback
- **THEN** the screen shows the recorded feedback tied to revision 7 and no authorization or external action occurs
- **VERIFIES** [[spec.review_revision_visible]]

### Requirement: Stale feedback preserved

The workbench SHALL explain stale responses, preserve unsent feedback as presentation data and require a fresh review before a response can target a changed revision.

#### Scenario: stale feedback explained
- **WHEN** revision 8 replaces revision 7 while feedback is being entered
- **THEN** submission is rejected through the shell, the draft remains visible and the reviewer must explicitly review revision 8 before submitting against it
- **VERIFIES** [[spec.stale_feedback_explained]]

### Requirement: Durable adapter conditional

The durable workbench adapter SHALL atomically condition state, replay and receipt writes on authoritative revisions and preserve deduplication across independent clients and reconstruction.

#### Scenario: adapter conflicts serialized
- **WHEN** two independent clients submit distinct responses from the same stored version
- **THEN** one response applies and the other conflicts; reconstruction and duplicate delivery do not create a second completion
- **VERIFIES** [[spec.adapter_conflicts_serialized]]

### Requirement: Resume visible

The workbench SHALL restore completed, pending and changed review information on reload and display uncertain or recovery-required outcomes without silently resetting stored state or retrying mutations.

#### Scenario: resume outcomes visible
- **WHEN** the page reloads after a normal commit or a commit with lost acknowledgement
- **THEN** history and original revision survive; uncertain effects block mutation until reconciliation and incompatible data remains preserved
- **VERIFIES** [[spec.resume_outcomes_visible]]

### Requirement: Consumer boundary

The workbench and headless consumer SHALL use only the shell public interface for policy, lifecycle, revision, deduplication and recovery decisions, with host bindings outside shell dependencies.

#### Scenario: consumer uses public surface
- **WHEN** consumer dependencies and interaction paths are inspected
- **THEN** neither consumer imports layer internals or implements acceptance or recovery rules and the shell has no transitive host dependency
- **VERIFIES** [[spec.consumer_uses_public_surface]]

### Requirement: Reuse evidence recorded

The evaluation SHALL compare the workbench and second consumer with a direct implementation under identical acceptance scenarios and record integration effort, custom coordination and a proceed, revise, narrow or defer decision.

#### Scenario: reuse comparison complete
- **WHEN** the second consumer and baseline complete the acceptance scenarios
- **THEN** the report separates initial and marginal effort, discloses familiarity and exclusions, counts consumer coordination and records whether reuse required core changes
- **VERIFIES** [[spec.reuse_comparison_complete]]
