// Purpose: public surface of the composition shell
// Responsibilities: export the consumer-contract types and the openReviewSession entry point under one barrel
// Rationale: hosts consumer-example.md (openspec/changes/add-composition-shell); callers import from this barrel, never from layer internals
export { COMPOSITION_SHELL_VERSION } from "./types";
export type {
  AggregateSnapshot,
  CommitDecisionCommand,
  CommitDecisionOutcome,
  CompletedReview,
  DecisionProvenance,
  EvaluateNeedOutcome,
  NeedProposalInput,
  OpenReviewSessionInput,
  OpenReviewSessionOutcome,
  PendingReview,
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  PortReceipt,
  PortReconcileOutcome,
  RefreshOutcome,
  ReviewCatalog,
  ReviewPersistencePort,
  ReviewPolicy,
  ReviewProjection,
  ReviewSessionShell,
  ReconcileOutcome,
  SessionTaskKey,
  SubmitEventCommand,
  SubmitOutcome,
  UpdateArtifactCommand,
  UpdateArtifactOutcome,
} from "./types";
import type {
  OpenReviewSessionInput,
  OpenReviewSessionOutcome,
} from "./types";

/**
 * Opens a review session from a trusted key, immutable policy/catalog inputs and
 * an explicitly declared persistence port. Behavior is owned by wanna-0te
 * (declared-port construction and load); this scaffold only fixes the signature.
 */
export async function openReviewSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature scaffold; behavior owned by wanna-0te
  _input: OpenReviewSessionInput,
): Promise<OpenReviewSessionOutcome> {
  throw new Error("not implemented: wanna-0te (declared-port open/load)");
}