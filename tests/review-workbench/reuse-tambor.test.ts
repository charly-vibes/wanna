// Purpose: tambor-rendered consumer tests for the composition shell (wanna-72s)
// Responsibilities: run the identical current/stale/restart acceptance suite
//   against the tambor-rendered demo (examples/review-tambor) and assert the
//   five typed submit outcomes render through the tambor widget stack; the
//   suite is shared, so this consumer is graded on exactly the same bar as the
//   headless shell consumer and the direct baseline
// Rationale: tambor-y9d.2 descope ruling — the shell semantics live in wanna's
//   corpus; the tambor demo mounts the REAL openReviewSession projection
//   through tambor's widgets via the interop seam (makeOpsApp) and adds only
//   view mapping plus a demo-local fault-injecting port wrapper. Driving the
//   demo through its button vectors and reading the TextBackend cell grid
//   keeps the assertions on the rendered UI.
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import {
  DRAFT_PATH,
  openTamborReview,
  type TamborReviewApp,
} from "../../examples/review-tambor";
import {
  currentStaleRestartSuite,
  type ScenarioClient,
  type ScenarioStorage,
} from "./reuse-scenarios";
import { TextBackend } from "@tambor/render/text.ts";
import type { AnyDraw } from "@tambor/render/primitives.ts";

const FIXTURE = {
  key: { sessionId: "tambor-session", taskId: "artifact-1" },
  policy: { policyVersion: "fixture-policy-1" },
  catalog: { catalogVersion: "fixture-catalog-1" },
  artifactId: "artifact-1",
} as const;

/** Draw the demo's current view through the corpus text backend and read the
 * cell grid. The container spans the whole view: corpus buttons carry generous
 * touch-slop padding and the slider track is TRACK_HEIGHT=10 cells tall, so the
 * mounted widget stack is ~100 cells tall. */
function renderedText(app: TamborReviewApp): string {
  const backend = new TextBackend({ containerSize: [100, 100] });
  backend.draw(app.view() as unknown as AnyDraw);
  return backend.grid.map((row) => row.join("")).join("\n");
}

/** The outcome-line prefixes mapped back to typed submit outcomes (order is
 * the demo's rendering contract: "unknown effect" must precede "unavailable"-less
 * generic refusals). */
const OUTCOME_KINDS: readonly (readonly [string, string])[] = [
  ["recorded", "recorded"],
  ["stale", "stale"],
  ["duplicate", "duplicate"],
  ["unavailable", "unavailable"],
  ["unknown", "unknown_effect"],
];

/** The typed submit outcome as the demo rendered it (the outcome line's first words). */
function parsedOutcome(app: TamborReviewApp): {
  kind: "recorded" | "stale" | "duplicate" | "refused" | "unavailable" | "unknown_effect";
  revision?: number;
} {
  const outcome = app.getState().outcome;
  const hit = OUTCOME_KINDS.find(([prefix]) => outcome.startsWith(prefix));
  const revision = outcome.match(/revision (\d+)/);
  return hit === undefined
    ? { kind: "refused" }
    : { kind: hit[1] as "recorded", revision: revision ? Number(revision[1]) : undefined };
}

/** Drive the demo through the same effect vectors its buttons carry. */
function uiClient(app: TamborReviewApp): ScenarioClient {
  return {
    view: () => app.getState().view,
    advanceArtifact: async (revision, contentRef) => {
      app.dispatch([["demo-advance", revision, contentRef]]);
      await app.settle();
      return app.getState().outcome.startsWith("refused") ? "refused" : "applied";
    },
    submitFeedback: async (eventId, feedback) => {
      app.dispatch([["set", DRAFT_PATH, feedback]]);
      app.dispatch([["demo-submit", eventId]]);
      await app.settle();
      return parsedOutcome(app);
    },
    freshReview: async () => {
      app.dispatch([["demo-fresh"]]);
      await app.settle();
      return app.getState().outcome.startsWith("refused") ? "refused" : "active";
    },
  };
}

/** The tambor-rendered shell consumer: storage is the durable IndexedDB adapter
 * wrapped by the demo's fault-injecting port. */
async function tamborStorage(): Promise<ScenarioStorage> {
  const indexedDB = new IDBFactory();
  return {
    client: async (): Promise<ScenarioClient> => {
      const port = await createReviewIndexDbPort({ indexedDB }, FIXTURE.key);
      const opened = await openTamborReview({
        port,
        key: FIXTURE.key,
        policy: FIXTURE.policy,
        catalog: FIXTURE.catalog,
        artifactId: FIXTURE.artifactId,
      });
      if (!("app" in opened)) {
        throw new Error(`tambor open failed: ${opened.kind} (${opened.reason})`);
      }
      // the scripted first path, through the rendered UI's own vectors
      opened.app.dispatch([["demo-advance", 7, "artifact-1/revisions/7"]]);
      await opened.app.settle();
      opened.app.dispatch([["demo-request", 7]]);
      await opened.app.settle();
      return uiClient(opened.app);
    },
  };
}

currentStaleRestartSuite(
  "reuse comparison: tambor-rendered shell consumer",
  tamborStorage,
);

/** One fresh app for the scripted fixture round trip. */
async function freshApp(): Promise<TamborReviewApp> {
  const indexedDB = new IDBFactory();
  const port = await createReviewIndexDbPort({ indexedDB }, FIXTURE.key);
  const opened = await openTamborReview({
    port,
    key: FIXTURE.key,
    policy: FIXTURE.policy,
    catalog: FIXTURE.catalog,
    artifactId: FIXTURE.artifactId,
  });
  if (!("app" in opened)) {
    throw new Error(`tambor open failed: ${opened.kind} (${opened.reason})`);
  }
  opened.app.dispatch([["demo-advance", 7, "artifact-1/revisions/7"]]);
  await opened.app.settle();
  opened.app.dispatch([["demo-request", 7]]);
  await opened.app.settle();
  return opened.app;
}

describe("review-tambor scripted fixture round trip", () => {
  it("renders the five typed submit outcomes through the tambor widgets", async () => {
    const app = await freshApp();

    // recorded — the happy path renders the revision it was tied to
    app.dispatch([["set", DRAFT_PATH, "looks good"]]);
    app.dispatch([["demo-submit", "fb-1"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^recorded on revision 7$/);
    expect(renderedText(app)).toContain("recorded on revision 7");

    // duplicate — the same event re-delivered never creates a second completion
    app.dispatch([["set", DRAFT_PATH, "looks good"]]);
    app.dispatch([["demo-submit", "fb-1"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^duplicate/);
    expect(renderedText(app)).toContain("duplicate");

    // stale — a host advance between display and submission is a typed stale
    app.dispatch([["demo-advance", 8, "artifact-1/revisions/8"]]);
    await app.settle();
    app.dispatch([["set", DRAFT_PATH, "early draft"]]);
    app.dispatch([["demo-submit", "fb-s"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^stale/);
    expect(renderedText(app)).toContain("stale");

    // fresh review, then recorded on the new revision
    app.dispatch([["demo-fresh"]]);
    await app.settle();
    app.dispatch([["set", DRAFT_PATH, "final words"]]);
    app.dispatch([["demo-submit", "fb-8"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^recorded on revision 8$/);

    // unavailable — the demo's fault button makes the next commit unanswerable
    app.armFault("unavailable", 1);
    app.dispatch([["set", DRAFT_PATH, "while storage is down"]]);
    app.dispatch([["demo-submit", "fb-u"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^unavailable/);
    expect(renderedText(app)).toContain("unavailable");

    // unknown_effect — a lost acknowledgement blocks mutations until reconcile
    app.armFault("unknown_effect", 1);
    app.dispatch([["set", DRAFT_PATH, "lost ack"]]);
    app.dispatch([["demo-submit", "fb-x"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^unknown effect/);
    expect(renderedText(app)).toContain("unknown effect");
    app.dispatch([["demo-reconcile", "fb-x"]]);
    await app.settle();
    // mutations work again after the uncertainty is resolved
    app.dispatch([["set", DRAFT_PATH, "after reconcile"]]);
    app.dispatch([["demo-submit", "fb-y"]]);
    await app.settle();
    expect(app.getState().outcome).toMatch(/^recorded on revision 8$/);
  });

  it("renders the projection's pending and completed reviews as widget text", async () => {
    const app = await freshApp();
    const text = renderedText(app);
    expect(text).toContain("revision 7");
    expect(text).toContain("pending");
  });
});
