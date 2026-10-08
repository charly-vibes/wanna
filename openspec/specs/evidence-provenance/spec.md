---
id: evidence.provenance
kind: intent
statement: THE Evidence and Provenance Layer SHALL retain traceable support for decisions, generated artifacts, human review, and capability changes
---

# Evidence and Provenance

Evidence records connect a result to its inputs, transformations, model-produced proposals, deterministic policy decisions, reviewer actions, tests, and deployed revisions. Provenance supports explanation and audit; it does not imply that an input source is true or that a human approval proves correctness.

## Constraints
| id | kind | expr | traces_to |
|---|---|---|---|
| evidence_has_identity | invariant | Every evidence record has a stable ID, evidence kind, source reference, timestamp or logical sequence, and schema version. | [[evidence.provenance]] |
| transformations_linked | invariant | Every derived claim or artifact links to the input evidence and transformation revision that produced it. | [[evidence.provenance]] |
| model_proposal_attributed | invariant | Model-produced proposals record the model/provider identifier when available, prompt or task revision reference, and proposal ID without requiring sensitive prompt content to be retained indefinitely. | [[evidence.provenance]] |
| review_action_attributed | invariant | Human review records the reviewed revision, action taken, and review scope; approval is not represented as proof of truth. | [[evidence.provenance]] |
| unknown_evidence_explicit | invariant | Missing, conflicting, stale, or unverifiable evidence is marked with an explicit status. | [[evidence.provenance]] |
| sensitive_data_minimized | invariant | Provenance retains the minimum data required for traceability and applies configured access, redaction, and retention rules. | [[evidence.provenance]] |
| audit_records_append_only | invariant | Committed audit records are append-only; corrections are represented as new linked records rather than silent edits. | [[evidence.provenance]] |

| evidence_class_recorded | invariant | Imported design claims distinguish normative_standard, empirical_evidence, established_guidance, architectural_synthesis, and design_hypothesis. | [[evidence.provenance]] |
| source_quality_not_normativity | invariant | A claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable. | [[evidence.provenance]] |

## Model
### States
- `proposed`
- `validated`
- `committed`
- `superseded`
- `restricted`

### Transitions
| id | from | to | guard |
|---|---|---|---|
| validate_evidence | proposed | validated | [[evidence.provenance.evidence_has_identity]] |
| commit_evidence | validated | committed | [[evidence.provenance.transformations_linked]] |
| supersede_evidence | committed | superseded | [[evidence.provenance.audit_records_append_only]] |
| restrict_sensitive_evidence | committed | restricted | [[evidence.provenance.sensitive_data_minimized]] |

## Properties
| id | kind | derives_from | generator | predicate |
|---|---|---|---|---|
| evidence_has_identity_holds | unit | [[evidence.provenance.evidence_has_identity]] | `any::<String>()` | `TypeScript conformance test: assert invariant evidence_has_identity at its trust boundary and under its stated edge cases.` |
| transformations_linked_holds | unit | [[evidence.provenance.transformations_linked]] | `any::<String>()` | `TypeScript conformance test: assert invariant transformations_linked at its trust boundary and under its stated edge cases.` |
| model_proposal_attributed_holds | unit | [[evidence.provenance.model_proposal_attributed]] | `any::<String>()` | `TypeScript conformance test: assert invariant model_proposal_attributed at its trust boundary and under its stated edge cases.` |
| review_action_attributed_holds | unit | [[evidence.provenance.review_action_attributed]] | `any::<String>()` | `TypeScript conformance test: assert invariant review_action_attributed at its trust boundary and under its stated edge cases.` |
| unknown_evidence_explicit_holds | unit | [[evidence.provenance.unknown_evidence_explicit]] | `any::<String>()` | `TypeScript conformance test: assert invariant unknown_evidence_explicit at its trust boundary and under its stated edge cases.` |
| sensitive_data_minimized_holds | unit | [[evidence.provenance.sensitive_data_minimized]] | `any::<String>()` | `TypeScript conformance test: assert invariant sensitive_data_minimized at its trust boundary and under its stated edge cases.` |
| audit_records_append_only_holds | unit | [[evidence.provenance.audit_records_append_only]] | `any::<String>()` | `TypeScript conformance test: assert invariant audit_records_append_only at its trust boundary and under its stated edge cases.` |
| research_claims_classified | unit | [[evidence.provenance.evidence_class_recorded]] | `any::<String>()` | `Traceability test: each research-derived normative constraint has an evidence classification` |
| p_source_quality_not_normativity | unit | [[evidence.provenance.source_quality_not_normativity]] | `arbitrary_state()` | `a claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable` |

## Requirements

### Requirement: Evidence and Provenance model transitions are observable

Each declared model transition is carried by a domain-behavior scenario naming the state change it authorizes and the properties that guard it; constraints not bound to a transition are carried by invariant-holding scenarios, so every deriving property remains scenario-verified. The conformance-gate scenario closes the set: revisions that break the model are rejected by the gate with a finding naming the violated row.

#### Scenario: validate-evidence moves `proposed` to `validated`
- **WHEN** the model is in the `proposed` state and the `validate_evidence` transition guard holds ([[evidence.provenance.evidence_has_identity]])
- **THEN** the model enters the `validated` state and records the transition
- **VERIFIES** [[evidence.provenance.evidence_has_identity_holds]]

#### Scenario: commit-evidence moves `validated` to `committed`
- **WHEN** the model is in the `validated` state and the `commit_evidence` transition guard holds ([[evidence.provenance.transformations_linked]])
- **THEN** the model enters the `committed` state and records the transition
- **VERIFIES** [[evidence.provenance.transformations_linked_holds]]

#### Scenario: supersede-evidence moves `committed` to `superseded`
- **WHEN** the model is in the `committed` state and the `supersede_evidence` transition guard holds ([[evidence.provenance.audit_records_append_only]])
- **THEN** the model enters the `superseded` state and records the transition
- **VERIFIES** [[evidence.provenance.audit_records_append_only_holds]]

#### Scenario: restrict-sensitive-evidence moves `committed` to `restricted`
- **WHEN** the model is in the `committed` state and the `restrict_sensitive_evidence` transition guard holds ([[evidence.provenance.sensitive_data_minimized]])
- **THEN** the model enters the `restricted` state and records the transition
- **VERIFIES** [[evidence.provenance.sensitive_data_minimized_holds]]

#### Scenario: model-proposal-attributed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Model-produced proposals record the model/provider identifier when available, prompt or task revision reference, and proposal ID without requiring sensitive prompt content to be retained indefinitely."
- **VERIFIES** [[evidence.provenance.model_proposal_attributed_holds]]

#### Scenario: review-action-attributed invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Human review records the reviewed revision, action taken, and review scope; approval is not represented as proof of truth."
- **VERIFIES** [[evidence.provenance.review_action_attributed_holds]]

#### Scenario: unknown-evidence-explicit invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Missing, conflicting, stale, or unverifiable evidence is marked with an explicit status."
- **VERIFIES** [[evidence.provenance.unknown_evidence_explicit_holds]]

#### Scenario: evidence-class-recorded invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "Imported design claims distinguish normative_standard, empirical_evidence, established_guidance, architectural_synthesis, and design_hypothesis."
- **VERIFIES** [[evidence.provenance.research_claims_classified]]

#### Scenario: source-quality-not-normativity invariant holds under canonical operation
- **WHEN** the system performs any operation governed by this specification
- **THEN** the invariant holds: "A claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable."
- **VERIFIES** [[evidence.provenance.p_source_quality_not_normativity]]

#### Scenario: Violating Evidence and Provenance invariant is rejected

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
