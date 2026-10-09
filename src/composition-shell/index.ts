// Purpose: public surface of the composition shell
// Responsibilities: export the consumer-contract types and the openReviewSession entry point under one barrel
// Rationale: hosts consumer-example.md (openspec/changes/add-composition-shell); callers import from this barrel, never from layer internals. wanna-0te owns the open/load behavior; wanna-15e/8k6/gcp own the remaining commands.
export { COMPOSITION_SHELL_VERSION } from "./types";
export { openReviewSession } from "./open";
export type {
  AggregateSnapshot,
  CommitDecisionCommand,
  CommitDecisionOutcome,
  CompletedReview,
  DecisionExclusion,
  DecisionProvenance,
  DecisionRecommendation,
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