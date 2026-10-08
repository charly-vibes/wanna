// Purpose: test fixtures for the interaction-primitives gate
// Responsibilities: build canonical valid revisions and the collapsed/invalid variants the corpus properties name
// Rationale: single source of shared layer vocabulary for transitions and properties tests
import type { PrimitiveRevision } from "../../src/interaction-primitives/types";

export function fullLayers(): PrimitiveRevision["layers"] {
  return [
    { layer: "need", typeToken: "Need", updateRule: "normalize proposals into typed needs" },
    { layer: "contribution", typeToken: "Contribution", updateRule: "accept smallest semantically complete contribution" },
    { layer: "pattern", typeToken: "InteractionPattern", updateRule: "compose patterns from primitives" },
    { layer: "interaction", typeToken: "InteractionContract", updateRule: "validate requests for contribution" },
    { layer: "presentation", typeToken: "PresentationContract", updateRule: "declare host-neutral semantics" },
    { layer: "process", typeToken: "ProcessModel", updateRule: "track lifecycle and waits" },
    { layer: "authority", typeToken: "AuthorityState", updateRule: "apply policy and grants" },
    { layer: "evidence", typeToken: "ProvenanceRecord", updateRule: "record why a decision exists" },
    { layer: "failure", typeToken: "FailureRecord", updateRule: "type deviations and effect certainty" },
    { layer: "recovery", typeToken: "RecoveryContract", updateRule: "retry, reconcile, or escalate" },
    { layer: "continuity", typeToken: "ContinuityRecord", updateRule: "checkpoint, reorient, and resume" },
  ];
}

export function validRevision(overrides: Partial<PrimitiveRevision> = {}): PrimitiveRevision {
  return {
    revisionId: "rev-1",
    layers: fullLayers(),
    mutatingOperations: ["deploy_revision"],
    failurePaths: [
      {
        operation: "deploy_revision",
        failureType: "deployment_failed",
        effectCertainty: "at_most_once",
        recovery: "rollback",
        recoveryPreconditions: ["previous revision still deployed"],
      },
    ],
    contracts: [
      { contractId: "c1", kind: "interaction", form: "declarative-data" },
      { contractId: "c2", kind: "presentation", form: "declarative-data" },
    ],
    provenance: [{ claimId: "e1", evidenceClass: "empirical_evidence" }],
    authorityGrants: [{ grantId: "g1", effect: "deploy_revision", source: "policy" }],
    selections: [
      {
        selectionId: "s1",
        needRef: "need-1",
        contributionRef: "contrib-1",
        presentationRef: "presentation-1",
      },
    ],
    continuityRecords: [
      {
        checkpointId: "cp1",
        stateDigest: "digest-1",
        reorientation: "brief the resuming agent on open bottlenecks",
        reconciliation: "reconcile in-flight contributions against the checkpoint",
      },
    ],
    ...overrides,
  };
}

export function collapsedRevision(): PrimitiveRevision {
  return validRevision({
    layers: [
      { layer: "need", typeToken: "SameToken", updateRule: "SameRule" },
      { layer: "contribution", typeToken: "SameToken", updateRule: "SameRule" },
    ],
  });
}