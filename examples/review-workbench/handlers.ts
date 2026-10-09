// Purpose: interaction handlers for the review workbench screen
// Responsibilities: wire reviewer and developer-demo controls and translate typed shell outcomes into visible screen state (recorded, stale-with-preserved-draft, duplicate, unavailable, uncertain-until-reconcile, retired); no shell decisions re-implemented
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa) — split from screen.ts for the pretender file-size gate; recovery acceptance is wanna-9r2
import type {
  ReviewSessionShell,
  SubmitOutcome,
} from "@wanna/composition-shell";
import type { ReviewFixture } from "./fixture";
import {
  contentRefFor,
  renderArtifact,
  renderHistory,
  setStatus,
} from "./dom";

/** Screen-local bookkeeping the shell does not expose (host-side only). */
export interface ScreenState {
  eventId: string;
  lastFeedback: string | null;
  /** The revision the mounted form displayed; submissions carry it so a change
   * since render is a typed stale rejection, never a silent retarget. */
  viewedRevision: number;
}

export function wireReviewerControls(
  section: HTMLElement,
  shell: ReviewSessionShell,
  state: ScreenState,
): void {
  const submit = section.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const feedback = section.querySelector<HTMLTextAreaElement>("#review-feedback")!;
  const cancel = [...section.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === "Cancel review",
  )!;
  submit.addEventListener("click", () => {
    void handleSubmit(section, shell, state, submit, feedback);
  });
  cancel.addEventListener("click", () => {
    void handleCancel(section, shell);
  });
}

export function wireDemoControls(
  section: HTMLElement,
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
  state: ScreenState,
): void {
  const advance = section.querySelector<HTMLButtonElement>(".demo-advance")!;
  const reconcile = section.querySelector<HTMLButtonElement>(".demo-reconcile")!;
  const redeliver = section.querySelector<HTMLButtonElement>(".demo-redeliver")!;
  const fresh = freshReviewButton(section);
  advance.addEventListener("click", () => {
    void handleAdvance(section, shell, fixture);
  });
  reconcile.addEventListener("click", () => {
    void handleReconcile(section, shell, state);
  });
  redeliver.addEventListener("click", () => {
    void handleRedeliver(section, shell, state);
  });
  fresh.addEventListener("click", () => {
    void handleFreshReview(section, shell, fixture, state);
  });
}

/** The reviewer-facing fresh-review control (hidden until a stale rejection needs it). */
function freshReviewButton(section: HTMLElement): HTMLButtonElement {
  return section.querySelector<HTMLButtonElement>(".demo-fresh-review")!;
}

async function handleSubmit(
  section: HTMLElement,
  shell: ReviewSessionShell,
  state: ScreenState,
  submit: HTMLButtonElement,
  feedback: HTMLTextAreaElement,
): Promise<void> {
  const view = shell.project();
  const outcome: SubmitOutcome = await shell.submit({
    eventId: state.eventId,
    interactionId: view.interactionId,
    expectedTaskRevision: state.viewedRevision,
    expectedInteractionRevision: view.interactionRevision,
    feedback: feedback.value,
  });
  if (outcome.kind === "recorded") {
    state.lastFeedback = feedback.value;
    const completed = shell.project().completedReviews.at(-1);
    renderHistory(section, shell.project());
    setStatus(
      section,
      `Feedback recorded for revision ${completed?.revision ?? view.taskRevision}: "${feedback.value}"`,
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
    const fresh = freshReviewButton(section);
    fresh.hidden = false;
    fresh.textContent = `Review revision ${shell.project().taskRevision}`;
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
    "The effect of this submission is uncertain. Nothing will be retried until the outcome is reconciled; the developer controls offer an explicit reconcile action.",
  );
  submit.disabled = true;
}

async function handleCancel(
  section: HTMLElement,
  shell: ReviewSessionShell,
): Promise<void> {
  const view = shell.project();
  const outcome = await shell.cancel({
    operationId: `cancel-review-${view.taskRevision}`,
    interactionId: view.interactionId,
  });
  if (outcome.kind === "retired") {
    renderHistory(section, shell.project());
    setStatus(section, `Review of revision ${view.taskRevision} was retired; history remains available.`);
    return;
  }
  if (outcome.kind === "stale") {
    setStatus(section, "The review is no longer active; nothing was retired.");
    return;
  }
  if (outcome.kind === "duplicate") {
    setStatus(section, "This review was already retired; nothing changed.");
    return;
  }
  setStatus(
    section,
    outcome.kind === "unavailable"
      ? "Storage is unavailable; the cancellation was not applied."
      : "The effect of the cancellation is uncertain; reconcile before retrying.",
  );
}

async function handleAdvance(
  section: HTMLElement,
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
): Promise<void> {
  const revision = fixture.demo.nextRevision;
  const update = await shell.updateArtifact({
    operationId: `artifact-revision-${revision}`,
    expectedAggregateVersion: shell.project().aggregateVersion,
    revision,
    contentRef: fixture.demo.contentRef,
  });
  if (update.kind !== "applied") {
    setStatus(section, `The demonstration revision advance was refused (${update.kind}).`);
    return;
  }
  renderArtifact(section, fixture, revision);
  setStatus(
    section,
    `Demonstration: the artifact advanced to revision ${revision}.`,
  );
}

async function handleReconcile(
  section: HTMLElement,
  shell: ReviewSessionShell,
  state: ScreenState,
): Promise<void> {
  const outcome = await shell.reconcile(state.eventId);
  if (outcome.kind === "applied") {
    renderHistory(section, shell.project());
    const completed = shell.project().completedReviews.at(-1);
    setStatus(
      section,
      completed
        ? `Reconciled: the feedback was recorded for revision ${completed.revision}.`
        : "Reconciled: the operation applied.",
    );
    return;
  }
  if (outcome.kind === "not_applied") {
    setStatus(section, "Reconciled: the operation did not apply; you may retry the review.");
    return;
  }
  setStatus(section, "The effect remains uncertain; reconciliation must be retried.");
}

async function handleRedeliver(
  section: HTMLElement,
  shell: ReviewSessionShell,
  state: ScreenState,
): Promise<void> {
  if (state.lastFeedback === null) {
    setStatus(section, "No recorded feedback to re-deliver.");
    return;
  }
  const view = shell.project();
  const outcome = await shell.submit({
    eventId: state.eventId,
    interactionId: view.interactionId,
    expectedTaskRevision: view.taskRevision,
    expectedInteractionRevision: view.interactionRevision,
    feedback: state.lastFeedback,
  });
  if (outcome.kind === "duplicate") {
    setStatus(section, "This feedback was already recorded; nothing changed.");
    return;
  }
  setStatus(section, `Re-delivery outcome: ${outcome.kind}.`);
}

async function handleFreshReview(
  section: HTMLElement,
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
  state: ScreenState,
): Promise<void> {
  const view = shell.project();
  const revision = view.taskRevision;
  const pending = view.pendingReviews.at(-1);
  if (pending) {
    const cancelled = await shell.cancel({
      operationId: `cancel-review-${pending.revision}`,
      interactionId: view.interactionId,
    });
    if (cancelled.kind !== "retired") {
      setStatus(section, `The previous review could not be retired (${cancelled.kind}).`);
      return;
    }
  }
  const interaction = await requestReviewFor(
    shell,
    fixture,
    revision,
    `create-review-${revision}`,
  );
  if (interaction === null) {
    setStatus(section, "The fresh review request was not accepted; no review is active.");
    return;
  }
  renderHistory(section, shell.project());
  renderArtifact(section, fixture, revision);
  state.eventId = `feedback-${revision}`;
  state.viewedRevision = revision;
  const submit = section.querySelector<HTMLButtonElement>("button[type=submit]")!;
  submit.disabled = false;
  const feedback = section.querySelector<HTMLTextAreaElement>("#review-feedback")!;
  feedback.disabled = false;
  const fresh = freshReviewButton(section);
  fresh.hidden = true;
  setStatus(section, `A fresh review of revision ${revision} is active; your draft is preserved.`);
}

/** Evaluate a need for `revision` and commit a decision; returns the interaction id or null. */
export async function requestReviewFor(
  shell: ReviewSessionShell,
  fixture: ReviewFixture,
  revision: number,
  operationId: string,
): Promise<string | null> {
  const decision = await shell.evaluateNeed({
    kind: fixture.request.kind,
    target: fixture.artifact.id,
    taskRevision: revision,
    proposalId: `proposal-${revision}`,
    evidenceRefs: [contentRefFor(fixture, revision)],
    evidenceStrength: fixture.request.evidenceStrength,
  });
  if (decision.kind !== "decided") return null;
  const committed = await shell.commitDecision({ operationId, decisionId: decision.id });
  return committed.kind === "committed" ? committed.interactionId : null;
}