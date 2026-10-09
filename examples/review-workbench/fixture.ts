// Purpose: scripted agent fixture requesting review of a specific artifact revision
// Responsibilities: provide the trusted fixture inputs (key, artifact identity/revision/content, review request) for the first-path consumer example; no policy, lifecycle or persistence decisions
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa) — the agent proposes, the human reviews; contents stay host-owned under a revision-specific reference
import type { ReviewCatalog, ReviewPolicy, SessionTaskKey } from "@wanna/composition-shell";

/** What the scripted agent asks a human to review, fully revision-bound. */
export interface ReviewFixture {
  readonly key: SessionTaskKey;
  readonly policy: ReviewPolicy;
  readonly catalog: ReviewCatalog;
  readonly artifact: {
    readonly id: string;
    readonly revision: number;
    readonly content: string;
    readonly contentRef: string;
  };
  readonly request: {
    readonly kind: string;
    readonly proposalId: string;
    readonly evidenceStrength: string;
    readonly reason: string;
  };
}

/** The scripted first-path scenario: review revision 7 of artifact-1. */
export function scriptedRevision7Fixture(): ReviewFixture {
  return {
    key: { sessionId: "session-1", taskId: "artifact-1" },
    policy: { policyVersion: "fixture-policy-1" },
    catalog: { catalogVersion: "fixture-catalog-1" },
    artifact: {
      id: "artifact-1",
      revision: 7,
      content:
        "Artifact revision 7: the design note explaining the review workbench flow.",
      contentRef: "artifact-1/revisions/7",
    },
    request: {
      kind: "review_artifact",
      proposalId: "proposal-7",
      evidenceStrength: "sufficient",
      reason:
        "The scripted agent requests human review of revision 7 before the note is recorded as accepted.",
    },
  };
}