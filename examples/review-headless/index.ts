// Purpose: headless second consumer of the composition shell (add-workbench-spa:3.1)
// Responsibilities: expose a review client without any DOM — aggregate view, host-owned artifact updates, review requests, feedback submission with typed stale/duplicate outcomes and explicit fresh review — using only the public shell barrel; all policy, lifecycle, revision, dedup and recovery decisions stay in the shell
// Rationale: wanna-zcq — the reuse-evidence second consumer; it must exercise stale input and resume through the same public API as the screen consumer, importing nothing layer-internal ([[review.workbench.consumer_boundary]])
import type {
  OpenReviewSessionInput,
  ReviewSessionShell,
  SessionTaskKey,
} from "@wanna/composition-shell";
import { openReviewSession } from "@wanna/composition-shell";

/** Open-failure variants surfaced verbatim from the shell construction. */
export type HeadlessOpenFailure = {
  readonly kind: "rejected" | "unavailable" | "recovery_required";
  readonly reason: string;
};

export type HeadlessOpenOutcome =
  | { readonly kind: "ready"; readonly client: HeadlessReviewClient }
  | HeadlessOpenFailure;

/** The projection fields a headless host observes. */
export interface HeadlessView {
  readonly taskRevision: number;
  readonly status: "active" | "completed" | "changed" | "pending" | "retired";
  readonly pendingReviews: readonly { readonly revision: number }[];
  readonly completedReviews: readonly {
    readonly revision: number;
    readonly feedback: string;
  }[];
}

export type HeadlessSubmitOutcome =
  | { readonly kind: "recorded"; readonly revision: number }
  | { readonly kind: "stale" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "unknown_effect" };

/** Commands the headless client accepts; no shell decision is re-implemented. */
export interface HeadlessReviewClient {
  /** Derived view of committed state; mutating it changes nothing. */
  view(): HeadlessView;
  /** Host-owned trusted artifact revision update (never a reviewer action). */
  advanceArtifact(revision: number, contentRef: string): Promise<"applied" | "refused">;
  /** Evaluate a review need for `revision` and commit the decision. */
  requestReview(revision: number): Promise<"requested" | "refused">;
  /** Reviewer feedback, dedup-scoped by event id against the displayed revision. */
  submitFeedback(eventId: string, feedback: string): Promise<HeadlessSubmitOutcome>;
  /** Retire any pending review and open a fresh one for the current revision. */
  freshReview(): Promise<"active" | "refused">;
}

/** Host-owned identity the need proposals target (the shell does not carry it). */
export interface HeadlessArtifactIdentity {
  readonly artifactId: string;
}

/**
 * Open a headless review session over the public shell. A missing or failing
 * port is surfaced verbatim as a non-ready outcome — no state was touched.
 */
export async function openHeadlessReview(
  input: OpenReviewSessionInput & HeadlessArtifactIdentity,
): Promise<HeadlessOpenOutcome> {
  const outcome = await openReviewSession(input);
  if (outcome.kind !== "ready") {
    return { kind: outcome.kind, reason: outcome.reason };
  }
  return {
    kind: "ready",
    client: new HeadlessClient(outcome.shell, input.artifactId),
  };
}

/** Consumer-owned coordination: displayed-revision bookkeeping plus outcome mapping. */
class HeadlessClient implements HeadlessReviewClient {
  /** The revision the active interaction displayed to the reviewer; submissions
   * carry it so a change since display is a typed stale, never a silent retarget.
   * Initialized from the loaded projection so a restarted client resumes against
   * the stored revision. */
  private viewedRevision: number;

  constructor(
    private readonly shell: ReviewSessionShell,
    private readonly artifactId: string,
  ) {
    this.viewedRevision = shell.project().taskRevision;
  }

  view(): HeadlessView {
    const p = this.shell.project();
    return {
      taskRevision: p.taskRevision,
      status: p.status,
      pendingReviews: p.pendingReviews.map((r) => ({ revision: r.revision })),
      completedReviews: p.completedReviews.map((r) => ({
        revision: r.revision,
        feedback: r.feedback,
      })),
    };
  }

  async advanceArtifact(revision: number, contentRef: string): Promise<"applied" | "refused"> {
    const p = this.shell.project();
    const outcome = await this.shell.updateArtifact({
      operationId: `artifact-${revision}`,
      // nothing stored yet → create-if-absent (duplicate tolerated on reopen);
      // otherwise a conditional advance against the authoritative version
      expectedAggregateVersion: p.taskRevision === 0 ? null : p.aggregateVersion,
      revision,
      contentRef,
    });
    // viewedRevision is intentionally untouched: an artifact advance is a host
    // event, not a display change — the displayed interaction stays bound to
    // the revision the reviewer saw, so the next submission is typed stale.
    // duplicate = the advance already applied (reopen): the artifact IS at the
    // requested revision, so the host outcome is idempotently applied.
    return outcome.kind === "applied" || outcome.kind === "duplicate"
      ? "applied"
      : "refused";
  }

  async requestReview(revision: number): Promise<"requested" | "refused"> {
    // idempotent reopen: a review for this revision already exists (restart) —
    // the reviewer resumes it instead of committing a second decision
    const current = this.shell.project();
    const existing =
      current.pendingReviews.some((r) => r.revision === revision) ||
      current.completedReviews.some((r) => r.revision === revision);
    if (existing) {
      this.viewedRevision = revision;
      return "requested";
    }
    const decision = await this.shell.evaluateNeed({
      kind: "review_artifact",
      target: this.artifactId,
      taskRevision: revision,
      proposalId: `proposal-${revision}`,
      evidenceRefs: [`revisions/${revision}`],
      evidenceStrength: "sufficient",
    });
    if (decision.kind !== "decided") return "refused";
    const committed = await this.shell.commitDecision({
      operationId: `create-review-${revision}`,
      decisionId: decision.id,
    });
    if (committed.kind !== "committed") {
      return "refused";
    }
    this.viewedRevision = revision;
    return "requested";
  }

  async submitFeedback(eventId: string, feedback: string): Promise<HeadlessSubmitOutcome> {
    const p = this.shell.project();
    const outcome = await this.shell.submit({
      eventId,
      interactionId: p.interactionId,
      expectedTaskRevision: this.viewedRevision,
      expectedInteractionRevision: p.interactionRevision,
      feedback,
    });
    if (outcome.kind === "recorded") {
      const completed = this.shell.project().completedReviews.at(-1);
      return { kind: "recorded", revision: completed?.revision ?? this.viewedRevision };
    }
    return outcome;
  }

  async freshReview(): Promise<"active" | "refused"> {
    const p = this.shell.project();
    if (p.pendingReviews.length > 0) {
      const cancelled = await this.shell.cancel({
        operationId: `cancel-review-${p.taskRevision}`,
        interactionId: p.interactionId,
      });
      if (cancelled.kind !== "retired") return "refused";
    }
    const requested = await this.requestReview(p.taskRevision);
    return requested === "requested" ? "active" : "refused";
  }
}

/** Session-task key helper for hosts that only have the raw parts. */
export function headlessSessionKey(sessionId: string, taskId: string): SessionTaskKey {
  return { sessionId, taskId };
}