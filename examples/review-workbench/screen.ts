// Purpose: the minimal semantic review screen consuming the public composition shell
// Responsibilities: bootstrap the screen (open the shell, run the scripted agent request or resume) and delegate rendering and interaction wiring; never re-implement shell decisions
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa) — display and draft presentation only; revision acceptance, policy, dedup and recovery decisions stay inside the shell ([[review.workbench.consumer_boundary]]); rendering is dom.ts, interaction handlers are handlers.ts
import type {
  ReviewPersistencePort,
  ReviewProjection,
  ReviewSessionShell,
} from "@wanna/composition-shell";
import { openReviewSession } from "@wanna/composition-shell";
import type { ReviewFixture } from "./fixture";
import { mountSection, setStatus } from "./dom";
import {
  requestReviewFor,
  wireDemoControls,
  wireReviewerControls,
  type ScreenState,
} from "./handlers";

/** Handle returned by the screen bootstrap for tests and host wiring. */
export interface ReviewScreenHandle {
  readonly root: HTMLElement;
  /** Null when opening the session failed and no reviewer controls were mounted. */
  readonly shell: ReviewSessionShell | null;
}

export interface ReviewScreenDeps {
  readonly document: Document;
  readonly port: ReviewPersistencePort;
  readonly fixture: ReviewFixture;
  readonly root?: HTMLElement;
}

/** Bootstrap: open the shell, run the scripted agent request or resume, mount the screen. */
export async function startReviewWorkbench(
  deps: ReviewScreenDeps,
): Promise<ReviewScreenHandle> {
  const root = deps.root ?? deps.document.body;
  const open = await openReviewSession({
    key: deps.fixture.key,
    policy: deps.fixture.policy,
    catalog: deps.fixture.catalog,
    port: deps.port,
  });
  if (open.kind !== "ready") {
    const section = mountSection(deps.document, root, deps.fixture, null);
    setStatus(
      section,
      `Cannot open the review session (${open.kind}): ${open.reason}. Existing data is preserved.`,
    );
    return { root: section, shell: null };
  }
  return bootstrapReady(deps, root, open.shell);
}

async function bootstrapReady(
  deps: ReviewScreenDeps,
  root: HTMLElement,
  shell: ReviewSessionShell,
): Promise<ReviewScreenHandle> {
  const view = shell.project();
  const state: ScreenState = {
    eventId: `feedback-${deps.fixture.artifact.revision}`,
    lastFeedback: null,
    viewedRevision: view.taskRevision,
  };
  if (hasNoReviews(view)) {
    const created = await requestInitialRevision(shell, deps.fixture);
    if (!created) {
      const section = mountSection(deps.document, root, deps.fixture, view);
      setStatus(section, "The review request was not accepted; no review is active.");
      return { root: section, shell };
    }
  }
  const section = mountSection(deps.document, root, deps.fixture, shell.project());
  state.viewedRevision = shell.project().taskRevision;
  wireReviewerControls(section, shell, state);
  wireDemoControls(section, shell, deps.fixture, state);
  return { root: section, shell };
}

function hasNoReviews(view: ReviewProjection): boolean {
  return (
    view.completedReviews.length === 0 &&
    view.pendingReviews.length === 0 &&
    view.retiredReviews.length === 0
  );
}

/** Scripted agent path: create the artifact revision, evaluate the need, commit the decision. Returns null when the request could not proceed (the screen shows a generic refusal; typed reasons stay shell-owned). */
async function requestInitialRevision(
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
): Promise<null | "created"> {
  const revision = fixture.artifact.revision;
  const update = await shell.updateArtifact({
    operationId: `artifact-revision-${revision}`,
    expectedAggregateVersion: null,
    revision,
    contentRef: fixture.artifact.contentRef,
  });
  // duplicate = this revision already exists (reopen); anything else
  // non-applied means the scripted request cannot proceed
  if (update.kind !== "applied" && update.kind !== "duplicate") return null;
  const interaction = await requestReviewFor(shell, fixture, revision, `create-review-${revision}`);
  return interaction === null ? null : "created";
}