// Purpose: reuse-comparison consumer tests (wanna-zcq)
// Responsibilities: run the identical current/stale/restart acceptance suite against both the shell-based headless consumer and the direct-implementation baseline; the graded behavior must be the same for both
// Rationale: add-workbench-spa:3.1 — [[review.workbench.reuse_comparison_complete]] requires both implementations under identical acceptance scenarios; a favorable claim additionally needs no new core behavior and less consumer-owned coordination than the baseline (recorded in docs/reuse-comparison.md and checked by reuse-report.test.ts)
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import {
  openHeadlessReview,
  type HeadlessReviewClient,
} from "../../examples/review-headless";
import {
  openBaselineReview,
} from "../../examples/review-baseline";
import {
  currentStaleRestartSuite,
  type ScenarioClient,
  type ScenarioStorage,
} from "./reuse-scenarios";

const FIXTURE = {
  key: { sessionId: "reuse-session", taskId: "artifact-1" },
  policy: { policyVersion: "fixture-policy-1" },
  catalog: { catalogVersion: "fixture-catalog-1" },
  artifactId: "artifact-1",
} as const;

/** The shell-based headless consumer: storage is the durable IndexedDB adapter. */
async function headlessStorage(): Promise<ScenarioStorage> {
  const indexedDB = new IDBFactory();
  return {
    client: async (): Promise<ScenarioClient> => {
      const port = await createReviewIndexDbPort({ indexedDB }, FIXTURE.key);
      const opened = await openHeadlessReview({
        port,
        key: FIXTURE.key,
        policy: FIXTURE.policy,
        catalog: FIXTURE.catalog,
        artifactId: FIXTURE.artifactId,
      });
      if (!("client" in opened)) {
        throw new Error(`headless open failed: ${opened.kind} (${opened.reason})`);
      }
      const client: HeadlessReviewClient = opened.client;
      // the scripted first path: revision 7 exists and a review is requested
      await client.advanceArtifact(7, "artifact-1/revisions/7");
      const requested = await client.requestReview(7);
      if (requested !== "requested") {
        throw new Error("headless first-path review request was refused");
      }
      return client;
    },
  };
}

/** The direct-implementation baseline: storage is a plain JSON snapshot map. */
async function baselineStorage(): Promise<ScenarioStorage> {
  const store = new Map<string, string>();
  return {
    client: async (): Promise<ScenarioClient> => {
      const client = await openBaselineReview({ store, key: FIXTURE.key.sessionId });
      // the identical scripted first path
      await client.advanceArtifact(7, "artifact-1/revisions/7");
      const requested = await client.requestReview(7);
      if (requested !== "requested") {
        throw new Error("baseline first-path review request was refused");
      }
      return client;
    },
  };
}

currentStaleRestartSuite(
  "reuse comparison: headless shell consumer",
  headlessStorage,
);
currentStaleRestartSuite(
  "reuse comparison: direct baseline",
  baselineStorage,
);