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
