// Purpose: the shared current/stale/restart acceptance scenarios for the reuse comparison (wanna-zcq)
// Responsibilities: define one uniform client interface and one scenario suite; the shell-based headless consumer and the direct-implementation baseline both run these identical steps — the suite owns no implementation
// Rationale: add-workbench-spa:3.1 — a favorable reuse claim requires both implementations to satisfy the same acceptance scenarios; keeping the steps in one module makes divergence impossible to hide
import { describe, expect, it } from "vitest";

/** The projection fields the acceptance scenarios observe. */
export interface ScenarioView {
  readonly taskRevision: number;
  readonly status: string;
  readonly pendingReviews: readonly { readonly revision: number }[];
  readonly completedReviews: readonly { readonly revision: number; readonly feedback: string }[];
}

/** Uniform submit outcome; `revision` is present exactly when the outcome is tied to one.
 * `unavailable`/`unknown_effect` exist because durable storage can fail or lose an
 * acknowledgement; the baseline's trivial store never produces them. */
export interface ScenarioSubmitResult {
  readonly kind:
    | "recorded"
    | "stale"
    | "duplicate"
    | "refused"
    | "unavailable"
    | "unknown_effect";
  readonly revision?: number;
}

/**
 * The client surface both implementations expose. Everything here is
 * consumer-owned coordination: the shell offers none of these aggregate
 * operations, and the baseline must reimplement the same semantics.
 */
export interface ScenarioClient {
  view(): ScenarioView;
  /** Host-owned trusted artifact change; never a reviewer action. */
  advanceArtifact(revision: number, contentRef: string): Promise<"applied" | "refused">;
  /** Reviewer feedback submission, dedup-scoped by event id. */
  submitFeedback(eventId: string, feedback: string): Promise<ScenarioSubmitResult>;
  /** Retire any pending review and open a fresh one for the current revision. */
  freshReview(): Promise<"active" | "refused">;
}

/**
 * A durable storage handle: `client()` opens a client over the storage,
 * possibly after a restart (a fresh process over the same durable state).
 */
export interface ScenarioStorage {
  client(): Promise<ScenarioClient>;
}

/**
 * The identical current/stale/restart acceptance scenarios. Both the headless
 * shell consumer and the direct baseline are graded by exactly this suite.
 */
export function currentStaleRestartSuite(
  name: string,
  makeStorage: () => Promise<ScenarioStorage>,
): void {
  describe(name, () => {
    it("current review records and duplicates never create a second completion", async () => {
      const client = await (await makeStorage()).client();
      const before = client.view();
      expect(before.taskRevision).toBe(7);
      expect(before.pendingReviews.map((r) => r.revision)).toContain(7);

      const recorded = await client.submitFeedback("fb-1", "looks good");
      expect(recorded.kind).toBe("recorded");
      expect(recorded.revision).toBe(7);
      expect(client.view().completedReviews).toEqual([
        { revision: 7, feedback: "looks good" },
      ]);

      // lost acknowledgement: the same event re-delivered is a duplicate
      const redelivered = await client.submitFeedback("fb-1", "looks good");
      expect(redelivered.kind).toBe("duplicate");
      expect(client.view().completedReviews).toHaveLength(1);
    });

    it("stale submission is rejected with an explicit fresh-review requirement", async () => {
      const client = await (await makeStorage()).client();
      expect(client.view().taskRevision).toBe(7);

      const applied = await client.advanceArtifact(8, "artifact-1/revisions/8");
      expect(applied).toBe("applied");

      // the reviewer began against revision 7; a revision-8 advance must
      // reject the submission, never silently retarget it
      const stale = await client.submitFeedback("fb-s", "early draft");
      expect(stale.kind).toBe("stale");
      expect(client.view().taskRevision).toBe(8);
      // the pending revision-7 review is preserved, not rebound
      expect(client.view().pendingReviews.map((r) => r.revision)).toContain(7);

      expect(await client.freshReview()).toBe("active");
      const now = client.view();
      expect(now.taskRevision).toBe(8);
      expect(now.pendingReviews.at(-1)?.revision).toBe(8);

      const recorded = await client.submitFeedback("fb-8", "final words");
      expect(recorded.kind).toBe("recorded");
      expect(recorded.revision).toBe(8);
    });

    it("restart restores history and re-delivery never duplicates a completion", async () => {
      const storage = await makeStorage();
      const first = await storage.client();
      const done = await first.submitFeedback("fb-r", "recorded before restart");
      expect(done.kind).toBe("recorded");

      // a fresh client process over the same durable storage
      const second = await storage.client();
      expect(second.view().completedReviews).toEqual([
        { revision: 7, feedback: "recorded before restart" },
      ]);

      // the first writer never saw the receipt: it re-delivers after restart
      const redelivered = await second.submitFeedback("fb-r", "recorded before restart");
      expect(redelivered.kind).toBe("duplicate");
      expect(second.view().completedReviews).toHaveLength(1);
    });
  });
}