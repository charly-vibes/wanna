// Purpose: the fault-port demo test for the lost-acknowledgement demonstration (wanna-5xi)
// Responsibilities: verify the demo's Lose-ack fault shows the risk its label
//   advertises — the armed submit IS persisted once by the inner storage while
//   its acknowledgement is suppressed (unknown_effect), reconcile resolves
//   `applied`, and a restart shows exactly one completion; a storage-down
//   submit stays unapplied (the separate not-applied uncertainty scenario)
// Rationale: the wrapper answered unknown_effect WITHOUT contacting the inner
//   port, so Lose ack → Submit → Reconcile always demonstrated not_applied —
//   the committed-but-unacknowledged risk was never shown. Infrastructure only
//   (tambor-y9d.2): the shell semantics are untouched.
import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import {
  DRAFT_PATH,
  openTamborReview,
  type TamborReviewApp,
} from "../../examples/review-tambor";

const FIXTURE = {
  key: { sessionId: "fault-session", taskId: "artifact-1" },
  policy: { policyVersion: "fixture-policy-1" },
  catalog: { catalogVersion: "fixture-catalog-1" },
  artifactId: "artifact-1",
} as const;

/** One open over a SHARED database, so a second open is a real restart. */
async function openOver(indexedDB: IDBFactory): Promise<TamborReviewApp> {
  const port = await createReviewIndexDbPort({ indexedDB }, FIXTURE.key);
  const opened = await openTamborReview({
    port,
    key: FIXTURE.key,
    policy: FIXTURE.policy,
    catalog: FIXTURE.catalog,
    artifactId: FIXTURE.artifactId,
  });
  if (!("app" in opened)) throw new Error(opened.reason);
  // the scripted first path: deliver revision 7, request its review
  opened.app.dispatch([["demo-advance", 7, "artifact-1/revisions/7"]]);
  await opened.app.settle();
  opened.app.dispatch([["demo-request", 7]]);
  await opened.app.settle();
  return opened.app;
}

describe("review-tambor fault port (wanna-5xi)", () => {
  it("Lose ack persists the submit once and reconcile resolves applied", async () => {
    const indexedDB = new IDBFactory();
    const app = await openOver(indexedDB);

    // arm the lost-ack fault and submit: the write reaches storage, the
    // shell only sees unknown_effect and blocks mutations
    app.armFault("unknown_effect", 1);
    app.dispatch([["set", DRAFT_PATH, "lost ack"]]);
    app.dispatch([["demo-submit", "fb-lost"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^unknown effect/);

    // reconcile resolves the uncertainty as APPLIED — the write did land
    app.dispatch([["demo-reconcile", "fb-lost"]]);
    await app.settle();
    expect(app.getState().outcome).toContain("reconciled: applied");

    // restart over the same storage: exactly one completion, no duplicate
    const restarted = await openOver(indexedDB);
    const completed = restarted.getState().view.completedReviews;
    expect(completed.map((r) => r.feedback)).toEqual(["lost ack"]);
  });

  it("Storage down keeps the submit unapplied (not_applied uncertainty)", async () => {
    const indexedDB = new IDBFactory();
    const app = await openOver(indexedDB);

    app.armFault("unavailable", 1);
    app.dispatch([["set", DRAFT_PATH, "while storage is down"]]);
    app.dispatch([["demo-submit", "fb-down"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^unavailable/);

    // reconcile: the storage never saw the write — not applied
    app.dispatch([["demo-reconcile", "fb-down"]]);
    await app.settle();
    expect(app.getState().outcome).toContain("not_applied");

    const restarted = await openOver(indexedDB);
    expect(
      restarted.getState().view.completedReviews.map((r) => r.feedback),
    ).toEqual([]);
  });
});
