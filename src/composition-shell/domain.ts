// Purpose: shell-owned aggregate domain state folded from the durable replay log (wanna-8k6)
// Responsibilities: tagged shell replay events, a defensive fold into interaction records, and the derived projection view over those records
// Rationale: the port persists only opaque replay entries; review continuity after reconstruction (restart, duplicate-after-restart) is derived by replaying the shell's tagged events — committed state itself is never aliased ([[composition.shell.projection_derived_not_authoritative]])
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  CompletedReview,
  DecisionProvenance,
  PendingReview,
  ReviewProjection,
} from "./types";

/** Replay event appended through `replayAdditions` when a review interaction opens. */
export interface ReviewOpenedEvent {
  readonly shellEvent: "review_opened";
  readonly interactionId: string;
  readonly reviewId: string;
  readonly revision: number;
  readonly interactionRevision: number;
  readonly provenance: DecisionProvenance;
}

/** Replay event appended through `replayAdditions` when feedback completes a review. */
export interface ReviewCompletedEvent {
  readonly shellEvent: "review_completed";
  readonly interactionId: string;
  readonly eventId: string;
  readonly feedback: string;
}

/**
 * Replay event appended through `replayAdditions` when an explicit retire,
 * cancel, supersede or expire command retires an active interaction
 * ([[composition.shell.retirement_explicit]]).
 */
export interface ReviewRetiredEvent {
  readonly shellEvent: "review_retired";
  readonly interactionId: string;
  readonly operationId: string;
}

export type ShellReplayEvent =
  | ReviewOpenedEvent
  | ReviewCompletedEvent
  | ReviewRetiredEvent;

/** One review interaction reconstructed from the replay log, in open order. */
export interface InteractionRecord {
  readonly interactionId: string;
  readonly interactionRevision: number;
  readonly reviewId: string;
  readonly revision: number;
  readonly provenance: DecisionProvenance;
  readonly status: "pending" | "completed" | "retired";
  readonly feedback: string | null;
}

/** Well-formedness gate: malformed or foreign replay entries are ignored, never folded. */
type ShellEventCandidate = Partial<ShellReplayEvent>;

function isReviewOpenedCandidate(c: ShellEventCandidate): boolean {
  return (
    c.shellEvent === "review_opened" &&
    typeof c.interactionId === "string" &&
    typeof c.reviewId === "string" &&
    typeof c.revision === "number" &&
    typeof c.interactionRevision === "number" &&
    isProvenance(c.provenance)
  );
}

function isReviewCompletedCandidate(c: ShellEventCandidate): boolean {
  return (
    c.shellEvent === "review_completed" &&
    typeof c.interactionId === "string" &&
    typeof c.eventId === "string" &&
    typeof c.feedback === "string"
  );
}

function isReviewRetiredCandidate(c: ShellEventCandidate): boolean {
  return (
    c.shellEvent === "review_retired" &&
    typeof c.interactionId === "string" &&
    typeof c.operationId === "string"
  );
}

export function isShellReplayEvent(value: unknown): value is ShellReplayEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as ShellEventCandidate;
  return (
    isReviewOpenedCandidate(candidate) ||
    isReviewCompletedCandidate(candidate) ||
    isReviewRetiredCandidate(candidate)
  );
}

function isProvenance(value: unknown): value is DecisionProvenance {
  return typeof value === "object" && value !== null;
}

/** Fold one event into the interaction list; completion retargets the matching interaction. */
export function foldReplayEvent(
  interactions: readonly InteractionRecord[],
  event: ShellReplayEvent,
): InteractionRecord[] {
  if (event.shellEvent === "review_opened") {
    return [
      ...interactions,
      {
        interactionId: event.interactionId,
        interactionRevision: event.interactionRevision,
        reviewId: event.reviewId,
        revision: event.revision,
        provenance: event.provenance,
        status: "pending",
        feedback: null,
      },
    ];
  }
  if (event.shellEvent === "review_retired") {
    // only a pending interaction retires; completed history is never reopened
    return interactions.map((record) =>
      record.interactionId === event.interactionId &&
      record.status === "pending"
        ? { ...record, status: "retired" }
        : record,
    );
  }
  return interactions.map((record) =>
    record.interactionId === event.interactionId
      ? { ...record, status: "completed", feedback: event.feedback }
      : record,
  );
}

/** Rebuild interaction state by replaying the shell's tagged events in durable order. */
export function domainFromReplay(
  replay: readonly unknown[],
): InteractionRecord[] {
  let interactions: InteractionRecord[] = [];
  for (const entry of replay) {
    if (!isShellReplayEvent(entry)) continue;
    interactions = foldReplayEvent(interactions, entry);
  }
  return interactions;
}

/** Latest interaction in open order, or null when none exists. */
export function latestInteraction(
  interactions: readonly InteractionRecord[],
): InteractionRecord | null {
  const last = interactions[interactions.length - 1];
  return last ?? null;
}

/** Deep copy of decision provenance so projections never alias replay storage. */
function copyProvenance(provenance: DecisionProvenance): DecisionProvenance {
  return {
    ...provenance,
    evidenceRefs: [...provenance.evidenceRefs],
    exclusions: provenance.exclusions.map((exclusion) => ({ ...exclusion })),
  };
}

function completedView(record: InteractionRecord): CompletedReview {
  return {
    reviewId: record.reviewId,
    revision: record.revision,
    feedback: record.feedback ?? "",
    provenance: copyProvenance(record.provenance),
  };
}

/** Observation status over the latest interaction: pending, changed (work moved), completed, retired. */
function projectedStatus(
  taskRevision: number,
  latest: InteractionRecord,
): ReviewProjection["status"] {
  if (latest.status === "retired") return "retired";
  if (latest.status === "completed") return "completed";
  return taskRevision > latest.revision ? "changed" : "pending";
}

/**
 * Derived projection over the authoritative task revision and the folded
 * interaction state ([[composition.shell.projection_derived_not_authoritative]]).
 * Every call returns a fresh, deep-copied view; mutating it cannot reach
 * committed or storage state.
 */
export function projectFromDomain(
  taskRevision: number,
  interactions: readonly InteractionRecord[],
): ReviewProjection {
  const latest = latestInteraction(interactions);
  if (latest === null) {
    return {
      taskRevision,
      interactionId: "",
      interactionRevision: 0,
      status: "active",
      feedback: null,
      provenance: null,
      completedReviews: [],
      pendingReviews: [],
      retiredReviews: [],
    };
  }
  const completedReviews = interactions
    .filter((record) => record.status === "completed")
    .map(completedView);
  const pendingReviews: PendingReview[] = interactions
    .filter((record) => record.status === "pending")
    .map((record) => ({ reviewId: record.reviewId, revision: record.revision }));
  const retiredReviews: PendingReview[] = interactions
    .filter((record) => record.status === "retired")
    .map((record) => ({ reviewId: record.reviewId, revision: record.revision }));
  return {
    taskRevision,
    interactionId: latest.interactionId,
    interactionRevision: latest.interactionRevision,
    status: projectedStatus(taskRevision, latest),
    feedback: latest.status === "completed" ? latest.feedback : null,
    provenance: copyProvenance(latest.provenance),
    completedReviews,
    pendingReviews,
    retiredReviews,
  };
}