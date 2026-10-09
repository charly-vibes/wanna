// Purpose: direct-implementation reuse baseline (add-workbench-spa:3.1)
// Responsibilities: satisfy the identical current/stale/restart acceptance scenarios with a small application-specific state machine over a plain JSON snapshot store — no composition shell, no adapter; revision binding, stale rejection, event dedup and restart persistence are all hand-owned here
// Rationale: wanna-zcq — the comparison baseline; every acceptance rule the shell owns must be re-implemented by hand, which is exactly the coordination cost the reuse evaluation measures
import type { ScenarioSubmitResult } from "../../tests/review-workbench/reuse-scenarios";

/** Durable storage: a JSON document per key (a stand-in for any real store). */
export type BaselineStore = Map<string, string>;

/** One review in the baseline state machine. */
interface BaselineReview {
  readonly id: string;
  readonly revision: number;
  readonly status: "active" | "completed" | "retired";
  readonly feedback: string | null;
}

/** The whole durable state, persisted as one JSON document. */
interface BaselineState {
  artifactRevision: number;
  reviews: BaselineReview[];
  /** event id → recorded revision; dedup survives restarts. */
  recordedEventIds: Record<string, number>;
}

function emptyState(): BaselineState {
  return { artifactRevision: 0, reviews: [], recordedEventIds: {} };
}

export interface BaselineOpenInput {
  readonly store: BaselineStore;
  readonly key: string;
}

export interface BaselineReviewClient {
  view(): {
    taskRevision: number;
    status: string;
    pendingReviews: readonly { readonly revision: number }[];
    completedReviews: readonly { readonly revision: number; readonly feedback: string }[];
  };
  advanceArtifact(revision: number, contentRef: string): Promise<"applied" | "refused">;
  requestReview(revision: number): Promise<"requested" | "refused">;
  submitFeedback(eventId: string, feedback: string): Promise<ScenarioSubmitResult>;
  freshReview(): Promise<"active" | "refused">;
}

/** Mutable session context the client methods operate on. */
interface BaselineCtx {
  readonly store: BaselineStore;
  readonly key: string;
  state: BaselineState;
  /** The revision the active interaction displayed; submissions carry it. */
  viewedRevision: number;
  reviewCounter: number;
}

function save(ctx: BaselineCtx): void {
  ctx.store.set(ctx.key, JSON.stringify(ctx.state));
}

function baselineView(ctx: BaselineCtx) {
  const active = ctx.state.reviews.filter((r) => r.status === "active");
  return {
    taskRevision: ctx.state.artifactRevision,
    status:
      active.length > 0
        ? "active"
        : ctx.state.reviews.some((r) => r.status === "completed")
          ? "completed"
          : "pending",
    pendingReviews: active.map((r) => ({ revision: r.revision })),
    completedReviews: ctx.state.reviews
      .filter(
        (r): r is BaselineReview & { feedback: string } =>
          r.status === "completed" && r.feedback !== null,
      )
      .map((r) => ({ revision: r.revision, feedback: r.feedback })),
  };
}

function baselineAdvance(ctx: BaselineCtx, revision: number): "applied" {
  ctx.state = { ...ctx.state, artifactRevision: revision };
  save(ctx);
  return "applied";
}

function appendReview(ctx: BaselineCtx, revision: number): void {
  ctx.reviewCounter += 1;
  ctx.state = {
    ...ctx.state,
    reviews: [
      ...ctx.state.reviews,
      {
        id: `review-${ctx.reviewCounter}`,
        revision,
        status: "active",
        feedback: null,
      },
    ],
  };
}

function baselineRequestReview(
  ctx: BaselineCtx,
  revision: number,
): "requested" | "refused" {
  // idempotent reopen: a review for this revision already exists (restart)
  const existing = ctx.state.reviews.find((r) => r.revision === revision);
  if (existing) {
    ctx.viewedRevision = revision;
    return "requested";
  }
  appendReview(ctx, revision);
  ctx.viewedRevision = revision;
  save(ctx);
  return "requested";
}

function baselineSubmit(
  ctx: BaselineCtx,
  eventId: string,
  feedback: string,
): ScenarioSubmitResult {
  const recorded = ctx.state.recordedEventIds[eventId];
  if (recorded !== undefined) {
    return { kind: "duplicate", revision: recorded };
  }
  const active = ctx.state.reviews.find((r) => r.status === "active");
  if (!active) return { kind: "refused" };
  // the reviewer began against the displayed revision; a change since
  // display is a typed stale, never a silent retarget
  if (ctx.viewedRevision !== ctx.state.artifactRevision) {
    return { kind: "stale" };
  }
  ctx.state = {
    ...ctx.state,
    reviews: ctx.state.reviews.map((r) =>
      r.id === active.id ? { ...r, status: "completed", feedback } : r,
    ),
    recordedEventIds: {
      ...ctx.state.recordedEventIds,
      [eventId]: active.revision,
    },
  };
  save(ctx);
  return { kind: "recorded", revision: active.revision };
}

function baselineFreshReview(ctx: BaselineCtx): "active" {
  const active = ctx.state.reviews.find((r) => r.status === "active");
  if (active) {
    ctx.state = {
      ...ctx.state,
      reviews: ctx.state.reviews.map((r) =>
        r.id === active.id ? { ...r, status: "retired" } : r,
      ),
    };
  }
  appendReview(ctx, ctx.state.artifactRevision);
  ctx.viewedRevision = ctx.state.artifactRevision;
  save(ctx);
  return "active";
}

/**
 * Open a baseline client over the durable store: load the snapshot or start
 * empty; every mutation re-persists before returning.
 */
export async function openBaselineReview(
  input: BaselineOpenInput,
): Promise<BaselineReviewClient> {
  const loaded = input.store.get(input.key);
  const ctx: BaselineCtx = {
    store: input.store,
    key: input.key,
    state: loaded ? (JSON.parse(loaded) as BaselineState) : emptyState(),
    viewedRevision: 0,
    reviewCounter: 0,
  };
  ctx.reviewCounter = ctx.state.reviews.length;
  ctx.viewedRevision = ctx.state.artifactRevision;
  return {
    view: () => baselineView(ctx),
    advanceArtifact: async (revision) => baselineAdvance(ctx, revision),
    requestReview: async (revision) => baselineRequestReview(ctx, revision),
    submitFeedback: async (eventId, feedback) =>
      baselineSubmit(ctx, eventId, feedback),
    freshReview: async () => baselineFreshReview(ctx),
  };
}
