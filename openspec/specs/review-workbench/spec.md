# review-workbench Specification

## Purpose
TBD - created by archiving change add-workbench-spa. Update Purpose after archive.
## Requirements
### Requirement: Revision visible

The workbench SHALL display the exact artifact identity, revision, content and review request associated with the shell projection and record feedback only through the public shell.

#### Scenario: review revision visible
- **WHEN** a reviewer opens revision 7 and submits valid feedback
- **THEN** the screen shows the recorded feedback tied to revision 7 and no authorization or external action occurs
- **VERIFIES** [[review.workbench.review_revision_visible]]

### Requirement: Stale feedback preserved

The workbench SHALL explain stale responses, preserve unsent feedback as presentation data and require a fresh review before a response can target a changed revision.

#### Scenario: stale feedback explained
- **WHEN** revision 8 replaces revision 7 while feedback is being entered
- **THEN** submission is rejected through the shell, the draft remains visible and the reviewer must explicitly review revision 8 before submitting against it
- **VERIFIES** [[review.workbench.stale_feedback_explained]]

### Requirement: Durable adapter conditional

The durable workbench adapter SHALL atomically condition state, replay and receipt writes on authoritative revisions and preserve deduplication across independent clients and reconstruction.

#### Scenario: adapter conflicts serialized
- **WHEN** two independent clients submit distinct responses from the same stored version
- **THEN** one response applies and the other conflicts; reconstruction and duplicate delivery do not create a second completion
- **VERIFIES** [[review.workbench.adapter_conflicts_serialized]]

### Requirement: Resume visible

The workbench SHALL restore completed, pending and changed review information on reload and display uncertain or recovery-required outcomes without silently resetting stored state or retrying mutations.

#### Scenario: resume outcomes visible
- **WHEN** the page reloads after a normal commit or a commit with lost acknowledgement
- **THEN** history and original revision survive; uncertain effects block mutation until reconciliation and incompatible data remains preserved
- **VERIFIES** [[review.workbench.resume_outcomes_visible]]

### Requirement: Consumer boundary

The workbench and headless consumer SHALL use only the shell public interface for policy, lifecycle, revision, deduplication and recovery decisions, with host bindings outside shell dependencies.

#### Scenario: consumer uses public surface
- **WHEN** consumer dependencies and interaction paths are inspected
- **THEN** neither consumer imports layer internals or implements acceptance or recovery rules and the shell has no transitive host dependency
- **VERIFIES** [[review.workbench.consumer_uses_public_surface]]

### Requirement: Reuse evidence recorded

The evaluation SHALL compare the workbench and second consumer with a direct implementation under identical acceptance scenarios and record integration effort, custom coordination and a proceed, revise, narrow or defer decision.

#### Scenario: reuse comparison complete
- **WHEN** the second consumer and baseline complete the acceptance scenarios
- **THEN** the report separates initial and marginal effort, discloses familiarity and exclusions, counts consumer coordination and records whether reuse required core changes
- **VERIFIES** [[review.workbench.reuse_comparison_complete]]

