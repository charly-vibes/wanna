// Purpose: recovery-acceptance consumer tests for the review workbench (wanna-9r2)
// Responsibilities: prove stale feedback handling, shared writers, reload resume, lost-acknowledgement blocking with reconciliation, cancellation after display, duplicate re-delivery and incompatible storage through the public shell and real durable adapter boundaries
// Rationale: [[review.workbench.stale_feedback_explained]] + [[review.workbench.resume_outcomes_visible]] — typed shell results wired into the workbench without duplicating core decisions; final recovery acceptance per add-workbench-spa:2.1
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import type { ReviewPersistencePort } from "../../src/composition-shell";
import {
  scriptedRevision7Fixture,
  startReviewWorkbench,
  type ReviewScreenHandle,
} from "../../examples/review-workbench";

function text(root: ParentNode, selector: string): string {
  const el = root.querySelector(selector);
  expect(el, `missing element ${selector}`).not.toBeNull();
  return (el as HTMLElement).textContent?.trim() ?? "";
}

function buttonByLabel(root: ParentNode, pattern: RegExp): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => pattern.test(b.textContent ?? ""),
  );
  expect(button, `no button matching ${pattern}`).not.toBeNull();
  return button!;
}

function feedbackOf(root: ParentNode): HTMLTextAreaElement {
  const feedback = root.querySelector<HTMLTextAreaElement>("#review-feedback");
  expect(feedback, "feedback textarea present").not.toBeNull();
  return feedback!;
}

async function renderScreen(
  port: ReviewPersistencePort,
): Promise<ReviewScreenHandle> {
  return startReviewWorkbench({ document, port, fixture: scriptedRevision7Fixture() });
}

async function firstPathRecorded(
  factory: IDBFactory,
  hooks?: Parameters<typeof createReviewIndexDbPort>[0]["hooks"],
): Promise<ReviewScreenHandle> {
  const fixture = scriptedRevision7Fixture();
  const port = await createReviewIndexDbPort({ indexedDB: factory, hooks }, fixture.key);
  const screen = await renderScreen(port);
  const { root, shell } = screen;
  expect(shell, "first path mounts a live shell").not.toBeNull();
  feedbackOf(root).value = "Needs one concrete example.";
  buttonByLabel(root, /submit feedback/i).click();
  await vi.waitFor(() => {
    expect(text(root, "[role=status]")).toMatch(/recorded|uncertain/);
  });
  return screen;
}

describe("review workbench screen: recovery", () => {
  it("stale feedback explained", async () => {
    const factory = new IDBFactory();
    const port = await createReviewIndexDbPort(
      { indexedDB: factory },
      scriptedRevision7Fixture().key,
    );
    const { root, shell } = await renderScreen(port);
    expect(shell!.project().taskRevision).toBe(7);

    // developer demonstration control: the artifact advances while feedback is
    // being entered (fault/revision controls live in their own section)
    buttonByLabel(root, /simulate artifact revision advance/i).click();
    await vi.waitFor(() => expect(shell!.project().taskRevision).toBe(8));

    // submission is rejected through the shell, the draft remains visible and
    // the reviewer must explicitly review revision 8 before submitting again
    feedbackOf(root).value = "Still needs an example.";
    buttonByLabel(root, /submit feedback/i).click();
    await vi.waitFor(() => {
      const status = text(root, "[role=status]");
      expect(status).toMatch(/changed|stale/i);
      expect(status).toContain("preserved");
    });
    expect(feedbackOf(root).value).toBe("Still needs an example.");

    // explicit fresh review — never a silent rebinding of the draft to revision 8
    const fresh = buttonByLabel(root, /review revision 8/i);
    expect(feedbackOf(root).value).toBe("Still needs an example.");
    fresh.click();
    // the fresh-review setup (cancel + new decision commit) is asynchronous;
    // the completion status is the signal, not the revision field (which the
    // demonstration advance already set to 8)
    await vi.waitFor(() => {
      expect(text(root, "[role=status]")).toMatch(/A fresh review of revision 8 is active/);
    });

    // now the reviewer submits against revision 8
    feedbackOf(root).value = "Good with the added example.";
    buttonByLabel(root, /submit feedback/i).click();
    await vi.waitFor(() => {
      expect(text(root, "[role=status]")).toContain("revision 8");
      expect(text(root, "[role=status]")).toContain("recorded");
    });
    expect(shell!.project().completedReviews.at(-1)).toEqual(
      expect.objectContaining({ revision: 8, feedback: "Good with the added example." }),
    );
  });

  it("shared writers surface one applied response and one conflict", async () => {
    const factory = new IDBFactory();
    const key = { sessionId: "session-1", taskId: "artifact-1" };
    const portA = await createReviewIndexDbPort({ indexedDB: factory }, key);
    const portB = await createReviewIndexDbPort({ indexedDB: factory }, key);
    const a = await renderScreen(portA);
    const b = await renderScreen(portB);

    // B resumes A's pending review from the shared store and submits a distinct
    // response: exactly one response applies, the other surfaces a conflict —
    // never a silent overwrite
    feedbackOf(a.root).value = "From writer A.";
    buttonByLabel(a.root, /submit feedback/i).click();
    await vi.waitFor(() => expect(text(a.root, "[role=status]")).toContain("recorded"));

    feedbackOf(b.root).value = "From writer B.";
    buttonByLabel(b.root, /submit feedback/i).click();
    await vi.waitFor(() => {
      expect(text(b.root, "[role=status]")).toMatch(/changed|stale|preserved/i);
    });

    // exactly one completion exists across both writers
    const completionsA = a.shell!.project().completedReviews.length;
    const completionsB = b.shell!.project().completedReviews.length;
    expect(completionsA + completionsB).toBe(1);
  });

  it("resume outcomes visible", async () => {
    // --- reload restores completed history and original provenance ---------
    const factory = new IDBFactory();
    await firstPathRecorded(factory);
    const reloaded = await renderScreen(
      await createReviewIndexDbPort({ indexedDB: factory }, scriptedRevision7Fixture().key),
    );
    await vi.waitFor(() => {
      const history = text(reloaded.root, "[data-resume=completed]");
      expect(history).toContain("revision 7");
      expect(history).toContain("Needs one concrete example.");
      expect(history).toContain("fixture-policy-1"); // provenance survives
    });

    // --- lost acknowledgement blocks mutation until reconciliation ---------
    const lostFactory = new IDBFactory();
    const hooks = { loseAckFor: (operationId: string) => operationId === "feedback-7" };
    const lost = await firstPathRecorded(lostFactory, hooks);
    await vi.waitFor(() => {
      const status = text(lost.root, "[role=status]");
      expect(status).toMatch(/uncertain/i);
      expect(status).toMatch(/reconcil/i);
    });
    expect(buttonByLabel(lost.root, /submit feedback/i).disabled).toBe(true);

    // explicit reconciliation proves the write applied and unblocks the flow
    buttonByLabel(lost.root, /reconcile/i).click();
    await vi.waitFor(() => {
      const status = text(lost.root, "[role=status]");
      expect(status).toContain("revision 7");
      expect(status).toContain("recorded");
    });
    const completedAfterReconcile =
      lost.shell!.project().completedReviews.length;
    expect(completedAfterReconcile).toBe(1); // replay never repeats the response

    // reconstruction after reload: the durable history is restored intact and
    // no second completion appears
    const reconstructed = await renderScreen(
      await createReviewIndexDbPort({ indexedDB: lostFactory }, scriptedRevision7Fixture().key),
    );
    await vi.waitFor(() => {
      expect(text(reconstructed.root, "[data-resume=completed]")).toContain("revision 7");
    });
    expect(reconstructed.shell!.project().completedReviews).toHaveLength(1);

    // --- cancellation after display keeps history inspectable ---------------
    const cancelFactory = new IDBFactory();
    const cancelPort = await createReviewIndexDbPort(
      { indexedDB: cancelFactory },
      scriptedRevision7Fixture().key,
    );
    const cancellable = await renderScreen(cancelPort);
    buttonByLabel(cancellable.root, /cancel review/i).click();
    await vi.waitFor(() => {
      expect(text(cancellable.root, "[role=status]")).toMatch(/retired|cancel/i);
      expect(text(cancellable.root, "[data-resume=retired]")).toContain("revision 7");
    });
    expect(cancellable.shell!.project().retiredReviews).toHaveLength(1);

    // --- duplicate re-delivery never creates a second completion -----------
    const dupFactory = new IDBFactory();
    const dup = await firstPathRecorded(dupFactory);
    buttonByLabel(dup.root, /re-deliver feedback/i).click();
    await vi.waitFor(() => {
      expect(text(dup.root, "[role=status]")).toMatch(/already recorded/i);
    });
    expect(dup.shell!.project().completedReviews).toHaveLength(1);

    // --- incompatible storage is recovery-required and data is preserved ---
    const corruptFactory = new IDBFactory();
    // the adapter creates the schema on first open; seed after that
    await createReviewIndexDbPort({ indexedDB: corruptFactory }, scriptedRevision7Fixture().key);
    const raw = corruptFactory.open("wanna-review");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      raw.onsuccess = () => resolve(raw.result);
      raw.onerror = () => reject(raw.error);
    });
    const tx = db.transaction("aggregates", "readwrite");
    tx.objectStore("aggregates").put(
      { schemaVersion: 999, junk: true },
      "session-1/artifact-1",
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    const corrupted = await renderScreen(
      await createReviewIndexDbPort({ indexedDB: corruptFactory }, scriptedRevision7Fixture().key),
    );
    await vi.waitFor(() => {
      const status = text(corrupted.root, "[role=status]");
      expect(status).toMatch(/recovery/i);
      expect(status).toMatch(/preserved/i);
    });
  });
});