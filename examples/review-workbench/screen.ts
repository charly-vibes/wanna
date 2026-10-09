// Purpose: the minimal semantic review screen consuming the public composition shell
// Responsibilities: render artifact identity/revision/content/request, accept feedback and submit it only through shell.submit, show the recorded outcome tied to the reviewed revision; keep non-ready/typed shell outcomes explicitly surfaced, never silently retried
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa) — display and draft presentation only; revision acceptance, policy, dedup and recovery decisions stay inside the shell ([[review.workbench.consumer_boundary]])
import type {
  ReviewPersistencePort,
  ReviewSessionShell,
  SubmitOutcome,
} from "@wanna/composition-shell";
import { openReviewSession } from "@wanna/composition-shell";
import type { ReviewFixture } from "./fixture";

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

/** Bootstrap: open the shell, run the scripted agent request, mount the review form. */
export async function startReviewWorkbench(
  deps: ReviewScreenDeps,
): Promise<ReviewScreenHandle> {
  const root = deps.root ?? deps.document.body;
  const fixture = deps.fixture;

  const open = await openReviewSession({
    key: fixture.key,
    policy: fixture.policy,
    catalog: fixture.catalog,
    port: deps.port,
  });
  if (open.kind !== "ready") {
    const root2 = mountSection(deps.document, root);
    setStatus(
      root2,
      `Cannot open the review session (${open.kind}): ${open.reason}. Existing data is preserved.`,
    );
    return { root: root2, shell: null };
  }

  const request = await requestReview(open.shell, fixture);
  if (request === null) {
    const root2 = mountSection(deps.document, root);
    setStatus(root2, "The review request was not accepted; no review is active.");
    return { root: root2, shell: open.shell };
  }

  const root2 = mountSection(deps.document, root, fixture);
  wireSubmit(deps.document, root2, open.shell, fixture);
  return { root: root2, shell: open.shell };
}

/** Scripted agent path: create the artifact revision, evaluate the need, commit the decision. Returns the committed interaction id, or null when the scripted request could not proceed (the screen then shows a generic refusal; typed reasons stay shell-owned). */
async function requestReview(
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
): Promise<string | null> {
  const update = await shell.updateArtifact({
    operationId: `artifact-revision-${fixture.artifact.revision}`,
    expectedAggregateVersion: null,
    revision: fixture.artifact.revision,
    contentRef: fixture.artifact.contentRef,
  });
  // duplicate = this revision already exists (reopen); anything else non-applied
  // means the scripted request cannot proceed
  if (update.kind !== "applied" && update.kind !== "duplicate") {
    return null;
  }

  const decision = await shell.evaluateNeed({
    kind: fixture.request.kind,
    target: fixture.artifact.id,
    taskRevision: fixture.artifact.revision,
    proposalId: fixture.request.proposalId,
    evidenceRefs: [fixture.artifact.contentRef],
    evidenceStrength: fixture.request.evidenceStrength,
  });
  if (decision.kind !== "decided") {
    return null;
  }

  const committed = await shell.commitDecision({
    operationId: `create-review-${fixture.artifact.revision}`,
    decisionId: decision.id,
  });
  return committed.kind === "committed" ? committed.interactionId : null;
}

function mountSection(
  document: Document,
  root: HTMLElement,
  fixture?: ReviewFixture,
): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Artifact review");
  if (!fixture) {
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    section.append(status);
    root.append(section);
    return section;
  }

  const heading = document.createElement("h1");
  heading.textContent = "Review requested";
  section.append(heading, field("Artifact", fixture.artifact.id, "artifact-identity"));

  const revision = field("Revision", String(fixture.artifact.revision), "artifact-revision");
  const content = field("Content", fixture.artifact.content, "artifact-content");
  const request = field("Review request", fixture.request.reason, "review-request");
  section.append(revision, content, request);

  const feedbackLabel = document.createElement("label");
  feedbackLabel.setAttribute("for", "review-feedback");
  feedbackLabel.textContent = "Review feedback";
  const feedback = document.createElement("textarea");
  feedback.id = "review-feedback";
  section.append(feedbackLabel, feedback);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Submit feedback";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  section.append(submit, status);
  root.append(section);
  return section;
}

function field(
  term: string,
  description: string,
  fieldName: string,
): HTMLElement {
  const dl = document.createElement("dl");
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.setAttribute("data-field", fieldName);
  dd.textContent = description;
  dl.append(dt, dd);
  return dl;
}

function setStatus(section: HTMLElement, message: string): void {
  const status = section.querySelector("[role=status]");
  if (status instanceof HTMLElement) {
    status.textContent = message;
  }
}

function wireSubmit(
  document: Document,
  section: HTMLElement,
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
): void {
  const submit = section.querySelector<HTMLButtonElement>("button[type=submit]");
  const feedback = section.querySelector<HTMLTextAreaElement>("#review-feedback");
  if (!submit || !feedback) {
    return;
  }
  submit.addEventListener("click", () => {
    void handleSubmit(section, shell, fixture, feedback.value, submit, feedback);
  });
}

async function handleSubmit(
  section: HTMLElement,
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
  draft: string,
  submit: HTMLButtonElement,
  feedback: HTMLTextAreaElement,
): Promise<void> {
  const view = shell.project();
  const outcome: SubmitOutcome = await shell.submit({
    eventId: `feedback-${fixture.artifact.revision}`,
    interactionId: view.interactionId,
    expectedTaskRevision: view.taskRevision,
    expectedInteractionRevision: view.interactionRevision,
    feedback: draft,
  });

  if (outcome.kind === "recorded") {
    const completed = shell.project().completedReviews.at(-1);
    setStatus(
      section,
      `Feedback recorded for revision ${completed?.revision ?? view.taskRevision}: "${draft}"`,
    );
    submit.disabled = true;
    feedback.disabled = true;
    return;
  }
  if (outcome.kind === "stale") {
    // draft stays in the textarea (presentation data preserved); the reviewer
    // must explicitly review the changed revision before submitting again
    setStatus(
      section,
      "The artifact changed since this review opened. Your draft is preserved below; start a fresh review before submitting it.",
    );
    return;
  }
  if (outcome.kind === "duplicate") {
    setStatus(section, "This feedback was already recorded; nothing changed.");
    submit.disabled = true;
    return;
  }
  if (outcome.kind === "unavailable") {
    setStatus(
      section,
      "Storage is unavailable right now; your draft is preserved. Retry later.",
    );
    return;
  }
  setStatus(
    section,
    "The effect of this submission is uncertain. Nothing will be retried until the outcome is reconciled.",
  );
}