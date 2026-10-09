// Purpose: DOM construction for the review workbench screen
// Responsibilities: mount the semantic review section (artifact fields, history, reviewer form, separate developer demo controls) and update its visible state; no shell decisions
// Rationale: hosts consumer-example.md (openspec/changes/add-workbench-spa) — split from screen.ts for the pretender file-size gate; display and draft presentation only
import type { ReviewFixture } from "./fixture";
import type { ReviewProjection } from "@wanna/composition-shell";

export function contentRefFor(fixture: ReviewFixture, revision: number): string {
  if (revision === fixture.artifact.revision) return fixture.artifact.contentRef;
  if (revision === fixture.demo.nextRevision) return fixture.demo.contentRef;
  return `${fixture.artifact.id}/revisions/${revision}`;
}

export function contentFor(fixture: ReviewFixture, revision: number): string {
  if (revision === fixture.artifact.revision) return fixture.artifact.content;
  if (revision === fixture.demo.nextRevision) return fixture.demo.content;
  return `${fixture.artifact.id} revision ${revision}`;
}

/** Mount the full screen: artifact fields, history, reviewer form, demo controls. */
export function mountSection(
  document: Document,
  root: HTMLElement,
  fixture: ReviewFixture,
  view: ReviewProjection | null,
): HTMLElement {
  const section = document.createElement("section");
  section.setAttribute("aria-label", "Artifact review");
  const revision = view?.taskRevision ?? fixture.artifact.revision;

  const heading = document.createElement("h1");
  heading.textContent = "Review requested";
  section.append(
    heading,
    field("Artifact", fixture.artifact.id, "artifact-identity"),
    field("Revision", String(revision), "artifact-revision"),
    field("Content", contentFor(fixture, revision), "artifact-content"),
    field("Review request", fixture.request.reason, "review-request"),
  );
  mountHistory(document, section);
  if (view) renderHistory(section, view);
  mountForm(document, section);
  mountDemoControls(document, section);
  root.append(section);
  return section;
}

function field(term: string, description: string, fieldName: string): HTMLElement {
  const dl = document.createElement("dl");
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.setAttribute("data-field", fieldName);
  dd.textContent = description;
  dl.append(dt, dd);
  return dl;
}

function mountHistory(document: Document, section: HTMLElement): void {
  const heading = document.createElement("h2");
  heading.textContent = "Review history";
  const completed = document.createElement("p");
  completed.setAttribute("data-resume", "completed");
  const pending = document.createElement("p");
  pending.setAttribute("data-resume", "pending");
  const retired = document.createElement("p");
  retired.setAttribute("data-resume", "retired");
  section.append(heading, completed, pending, retired);
}

export function renderHistory(section: HTMLElement, view: ReviewProjection): void {
  const completed = section.querySelector("[data-resume=completed]")!;
  completed.textContent = view.completedReviews
    .map(
      (r) =>
        `Completed revision ${r.revision} — "${r.feedback}" (policy ${r.provenance.policyVersion})`,
    )
    .join("; ");
  section.querySelector("[data-resume=pending]")!.textContent = view.pendingReviews
    .map((r) => `Pending revision ${r.revision}`)
    .join("; ");
  section.querySelector("[data-resume=retired]")!.textContent = view.retiredReviews
    .map((r) => `Retired revision ${r.revision}`)
    .join("; ");
}

function mountForm(document: Document, section: HTMLElement): void {
  const feedbackLabel = document.createElement("label");
  feedbackLabel.setAttribute("for", "review-feedback");
  feedbackLabel.textContent = "Review feedback";
  const feedback = document.createElement("textarea");
  feedback.id = "review-feedback";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Submit feedback";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel review";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  section.append(feedbackLabel, feedback, submit, cancel, status);
}

function mountDemoControls(document: Document, section: HTMLElement): void {
  const aside = document.createElement("aside");
  aside.setAttribute("aria-label", "Developer demonstration controls");
  const heading = document.createElement("h2");
  heading.textContent = "Developer controls";
  const advance = document.createElement("button");
  advance.type = "button";
  advance.className = "demo-advance";
  advance.textContent = "Simulate artifact revision advance";
  const reconcile = document.createElement("button");
  reconcile.type = "button";
  reconcile.className = "demo-reconcile";
  reconcile.textContent = "Reconcile pending operation";
  const redeliver = document.createElement("button");
  redeliver.type = "button";
  redeliver.className = "demo-redeliver";
  redeliver.textContent = "Re-deliver feedback";
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "demo-fresh-review";
  fresh.hidden = true;
  aside.append(heading, advance, reconcile, redeliver, fresh);
  section.append(aside);
}

export function setStatus(section: HTMLElement, message: string): void {
  const status = section.querySelector("[role=status]");
  if (status instanceof HTMLElement) status.textContent = message;
}