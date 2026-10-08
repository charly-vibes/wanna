// Purpose: executable consumer contract for the artifact-review slice (consumer-example.md)
// Responsibilities: host the consumer example against ONLY the public composition-shell barrel; assert typed outcomes and export surface; behavior branches stay todo until their owning tickets land
// Rationale: openspec/changes/add-composition-shell/consumer-example.md + specs/composition-shell/spec.md; scaffold contract per wanna-y8j, behavior owned by wanna-0te/15e/8k6/gcp
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as shellApi from "../../src/composition-shell";
import type {
  CommitDecisionOutcome,
  OpenReviewSessionOutcome,
  ReviewCatalog,
  ReviewPersistencePort,
  ReviewProjection,
  ReviewSessionShell,
  ReviewPolicy,
  SessionTaskKey,
  SubmitOutcome,
} from "../../src/composition-shell";

/**
 * The consumer example from consumer-example.md, expressed entirely through the
 * public barrel. This function is compile-checked by `tsc --noEmit` and the vitest
 * type gate but never executed at runtime while behavior is unimplemented —
 * calling it would throw the scaffold's not-implemented error.
 */
function assertOpenReady(
  open: OpenReviewSessionOutcome,
): ReviewSessionShell {
  if (open.kind === "ready") return open.shell;
  // unavailable and recovery_required must be handled explicitly
  throw new Error(`open did not succeed: ${open.kind}`);
}

function assertDecisionCommitted(
  committed: CommitDecisionOutcome,
): void {
  if (committed.kind !== "committed") {
    throw new Error(`decision commit failed: ${committed.kind}`);
  }
}

function assertSubmitRecorded(result: SubmitOutcome): void {
  if (result.kind === "recorded") return;
  // recorded, stale, duplicate, unavailable and unknown_effect are all explicit
  throw new Error(`submit outcome handled explicitly: ${result.kind}`);
}

async function consumerExampleFlow(
  policy: ReviewPolicy,
  catalog: ReviewCatalog,
  port: ReviewPersistencePort,
): Promise<ReviewProjection> {
  const key: SessionTaskKey = { sessionId: "session-1", taskId: "artifact-1" };
  const shell = assertOpenReady(
    await shellApi.openReviewSession({ key, policy, catalog, port }),
  );
  await shell.updateArtifact({
    operationId: "artifact-revision-7", expectedAggregateVersion: null,
    revision: 7, contentRef: "artifact-1/revisions/7",
  });
  const decision = await shell.evaluateNeed({
    kind: "review_artifact", target: "artifact-1", taskRevision: 7,
    proposalId: "proposal-7", evidenceRefs: ["artifact-1/revisions/7"],
    evidenceStrength: "sufficient",
  });
  if (decision.kind !== "decided") {
    throw new Error(`evaluation refused: ${decision.kind}`);
  }
  assertDecisionCommitted(
    await shell.commitDecision({
      operationId: "create-review-7", decisionId: decision.id,
    }),
  );
  const view = shell.project();
  assertSubmitRecorded(
    await shell.submit({
      eventId: "feedback-7", interactionId: view.interactionId,
      expectedTaskRevision: 7, expectedInteractionRevision: view.interactionRevision,
      feedback: "The explanation needs one concrete example.",
    }),
  );
  // A new shell using the same port loads receipts and pending/completed reviews.
  const resumed = await shellApi.openReviewSession({ key, policy, catalog, port });
  if (resumed.kind !== "ready") {
    throw new Error(`resume failed: ${resumed.kind}`);
  }
  return resumed.shell.project();
}

describe("composition-shell consumer contract", () => {
  it("public barrel exposes the consumer example surface", () => {
    expect(typeof shellApi.openReviewSession).toBe("function");
    expect(shellApi.COMPOSITION_SHELL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof consumerExampleFlow).toBe("function");
  });

  it("open outcome discriminates ready, unavailable and recovery_required", () => {
    const samples: OpenReviewSessionOutcome[] = [
      { kind: "ready", shell: {} as ReviewSessionShell },
      { kind: "unavailable", reason: "port load failed" },
      { kind: "recovery_required", reason: "corrupt persisted replay" },
    ];
    expect(new Set(samples.map((s) => s.kind))).toEqual(
      new Set(["ready", "unavailable", "recovery_required"]),
    );
  });

  it("submit outcome discriminates recorded, stale, duplicate, unavailable and unknown_effect", () => {
    const receipt = { operationId: "feedback-7", applied: true };
    const samples: SubmitOutcome[] = [
      { kind: "recorded" },
      { kind: "stale" },
      { kind: "duplicate", receipt },
      { kind: "unavailable" },
      { kind: "unknown_effect" },
    ];
    expect(new Set(samples.map((s) => s.kind))).toEqual(
      new Set(["recorded", "stale", "duplicate", "unavailable", "unknown_effect"]),
    );
  });

  it("composition shell module imports no host or transport modules", () => {
    const dir = join(import.meta.dirname, "..", "..", "src", "composition-shell");
    for (const file of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const source = readFileSync(join(dir, file), "utf8");
      const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const spec of specifiers) {
        // only relative imports inside the module; no host, transport or layer internals
        expect(
          spec.startsWith("."),
          `${file} imports non-relative module ${spec}`,
        ).toBe(true);
        expect(
          spec.startsWith("../"),
          `${file} imports outside the shell module: ${spec}`,
        ).toBe(false);
      }
    }
  });

  // Behavior branches below are the consumer example's executable assertions.
  // They stay todo until their owning implementation tickets land (wanna-9wu
  // turns consumer-example.md into the failing public-API contract).
  it.todo("first review: revision 7 completes with feedback and provenance persisted, no authorization (wanna-8k6)");
  it.todo("stale decision: artifact to 8 then commit revision-7 decision is typed stale, no review for 8 (wanna-8k6)");
  it.todo("stale response: submit old feedback after artifact 8 is typed stale, refresh explains changed work (wanna-8k6)");
  it.todo("new review: supersede 7, review 8 has new identity binding, history inspectable (wanna-gcp)");
  it.todo("shared writers: two shells one base version, one applied one conflict (wanna-8k6)");
  it.todo("duplicate delivery: retried event id returns typed duplicate correlated with stored receipt (wanna-8k6)");
  it.todo("restart: reopen durable store restores revisions, reviews and provenance (wanna-gcp)");
  it.todo("lost acknowledgement: unknown effect blocks mutation until reconcile, replay never repeats (wanna-gcp)");
  it.todo("unsupported or empty need: typed refusal or no-candidate with exclusions (wanna-15e)");
  it.todo("cancel after display: explicit cancel retires review, history remains (wanna-gcp)");
  it.todo("incompatible storage: recovery_required with existing data preserved (wanna-gcp)");
  it.todo("construction without a declared port is rejected (wanna-0te)");
  it.todo("decision result carries pinned policy and catalog versions (wanna-15e)");
});