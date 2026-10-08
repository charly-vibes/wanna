// Purpose: open/construction/persistence contract for the composition shell (wanna-0te)
// Responsibilities: typed construction rejection, no-mutation open semantics, projection immutability, port load failure mapping, canonical stored-revision refusal and incompatible-storage recovery through ONLY the public composition-shell barrel
// Rationale: openspec/changes/add-composition-shell/specs/composition-shell/spec.md scenarios port-is-constructor-required, commits-only-via-port, projection-mutation-is-inert, port-failure-semantics-tested, review-mapping-checked and incompatible-stored-version; commit/submit semantics stay with wanna-8k6/gcp
import { describe, expect, it } from "vitest";
import * as shellApi from "../../src/composition-shell";
import type {
  OpenReviewSessionInput,
  PortLoadOutcome,
  ReviewPersistencePort,
  SessionTaskKey,
} from "../../src/composition-shell";
import { CATALOG, FakeReviewStore, KEY, POLICY } from "./consumer-support";

/** Port-call counters proving construction rejection happens before any port contact. */
interface PortCallCounts {
  load: number;
  commit: number;
  reconcile: number;
}

/**
 * Port that counts every declared-port call and fails loudly on commit/reconcile —
 * the open slice must never reach them.
 */
function countingPort(load: () => Promise<PortLoadOutcome>): {
  port: ReviewPersistencePort;
  calls: PortCallCounts;
} {
  const calls: PortCallCounts = { load: 0, commit: 0, reconcile: 0 };
  const port: ReviewPersistencePort = {
    supportsAtomicCommitAndReplay: true,
    deduplicationScope: new Set([KEY.sessionId]),
    load: async () => {
      calls.load += 1;
      return load();
    },
    compareAndCommit: async () => {
      calls.commit += 1;
      throw new Error("counting port: commit must not happen during open");
    },
    reconcile: async () => {
      calls.reconcile += 1;
      throw new Error("counting port: reconcile must not happen during open");
    },
  };
  return { port, calls };
}

function openInput(
  port: ReviewPersistencePort,
  key: SessionTaskKey = KEY,
): OpenReviewSessionInput {
  return { key, policy: POLICY, catalog: CATALOG, port };
}

/** Consumer-side setup: create the aggregate through the declared conditional commit only. */
async function persistRevision(
  port: ReviewPersistencePort,
  key: SessionTaskKey,
  revision: number,
): Promise<void> {
  const commit = await port.compareAndCommit(
    key,
    null,
    {
      operationId: "direct-create",
      expectedTaskRevision: null,
      expectedInteractionRevision: null,
      stateChanges: { taskRevision: revision },
      replayAdditions: [],
    },
  );
  if (commit.kind !== "applied")
    throw new Error(`setup: expected applied create, got ${commit.kind}`);
}

describe("composition-shell open (wanna-0te)", () => {
  it("port-is-constructor-required — constructing without a declared port, deduplication scope, key, policy or catalog is a typed rejection before any port contact", async () => {
    const { port, calls } = countingPort(() => Promise.resolve({ kind: "not_found" }));
    const portWithoutScope = {
      supportsAtomicCommitAndReplay: true,
      load: port.load,
      compareAndCommit: port.compareAndCommit,
      reconcile: port.reconcile,
    } as unknown as ReviewPersistencePort;
    const variants: ReadonlyArray<[string, OpenReviewSessionInput]> = [
      ["missing port", { ...openInput(port), port: undefined as unknown as ReviewPersistencePort }],
      ["port without declared methods", {
        ...openInput(port),
        port: { deduplicationScope: new Set(["s"]) } as unknown as ReviewPersistencePort,
      }],
      ["empty deduplication scope", openInput({ ...port, deduplicationScope: new Set<string>() })],
      ["key without taskId", openInput(port, { sessionId: "session-1" } as unknown as SessionTaskKey)],
      ["empty policy version", { ...openInput(port), policy: { policyVersion: "" } }],
      ["empty catalog version", { ...openInput(port), catalog: { catalogVersion: "" } }],
      ["port without a deduplication scope", openInput(portWithoutScope)],
    ];
    for (const [label, input] of variants) {
      const outcome = await shellApi.openReviewSession(input);
      expect(outcome.kind, label).toBe("rejected");
      if (outcome.kind !== "rejected") throw new Error(`expected rejected, got ${outcome.kind}`);
      expect(outcome.reason.length, label).toBeGreaterThan(0);
    }
    expect(calls.load).toBe(0);
    expect(calls.commit).toBe(0);
    expect(calls.reconcile).toBe(0);
  });

  it("commits-only-via-port — opening mutates nothing and aggregate creation happens only through the port's conditional commit", async () => {
    const store = new FakeReviewStore();
    const opened = await shellApi.openReviewSession(
      openInput(store.port(KEY)),
    );
    if (opened.kind !== "ready")
      throw new Error(`expected ready open on missing key, got ${opened.kind}`);
    // a missing key opens ready but persists nothing
    expect(store.rawState(KEY).aggregateVersion).toBe(0);
    expect(store.rawState(KEY).replay).toHaveLength(0);
    expect(opened.shell.project().taskRevision).toBe(0);

    // the only mutation route is the port's conditional commit, not the shell
    await persistRevision(store.port(KEY), KEY, 7);
    const reopened = await shellApi.openReviewSession(openInput(store.port(KEY)));
    if (reopened.kind !== "ready")
      throw new Error(`expected ready reopen, got ${reopened.kind}`);
    expect(store.rawState(KEY).aggregateVersion).toBe(1);
    expect(reopened.shell.project().taskRevision).toBe(7);
  });

  it("projection-mutation-is-inert — mutating a projected copy never changes committed state", async () => {
    const store = new FakeReviewStore();
    await persistRevision(store.port(KEY), KEY, 7);
    const opened = await shellApi.openReviewSession(openInput(store.port(KEY)));
    if (opened.kind !== "ready")
      throw new Error(`expected ready open, got ${opened.kind}`);
    const view = opened.shell.project();
    (view as unknown as { taskRevision: number }).taskRevision = 99;
    (view.completedReviews as unknown[]).push("junk");

    expect(view.taskRevision).toBe(99); // the copy mutates freely
    expect(opened.shell.project().taskRevision).toBe(7); // committed state does not
    expect(store.rawState(KEY).taskRevision).toBe(7);
    expect(store.rawState(KEY).aggregateVersion).toBe(1);
    expect(opened.shell.project()).not.toBe(view); // each projection is a fresh copy
  });

  it("port-failure-semantics-tested — injected load failures return declared typed outcomes with a non-empty reason and no mutation", async () => {
    const unavailable = new FakeReviewStore();
    unavailable.setLoadOverride({ kind: "unavailable" });
    const unavailableOpen = await shellApi.openReviewSession(
      openInput(unavailable.port(KEY)),
    );
    if (unavailableOpen.kind !== "unavailable")
      throw new Error(`expected unavailable, got ${unavailableOpen.kind}`);
    expect(unavailableOpen.reason.length).toBeGreaterThan(0);
    expect(unavailable.rawState(KEY).aggregateVersion).toBe(0);

    const recovery = new FakeReviewStore();
    recovery.setLoadOverride({ kind: "recovery_required" });
    const recoveryOpen = await shellApi.openReviewSession(
      openInput(recovery.port(KEY)),
    );
    if (recoveryOpen.kind !== "recovery_required")
      throw new Error(`expected recovery_required, got ${recoveryOpen.kind}`);
    expect(recoveryOpen.reason.length).toBeGreaterThan(0);
    expect(recovery.rawState(KEY).aggregateVersion).toBe(0);

    // a thrown load failure obeys the same declared typed outcome
    const { port, calls } = countingPort(() =>
      Promise.reject(new Error("storage exploded")),
    );
    const thrownOpen = await shellApi.openReviewSession(openInput(port));
    expect(thrownOpen.kind).toBe("unavailable");
    if (thrownOpen.kind !== "unavailable")
      throw new Error(`expected unavailable, got ${thrownOpen.kind}`);
    expect(thrownOpen.reason.length).toBeGreaterThan(0);
    expect(calls.load).toBe(1);
  });

  it("review-mapping-checked — a noncanonical or unsafe stored revision is refused as recovery_required without state mutation", async () => {
    // non-integer task revision
    const fractional = new FakeReviewStore();
    await persistRevision(fractional.port(KEY), KEY, 7);
    fractional.rawState(KEY).taskRevision = 2.5;
    const before = fractional.rawState(KEY);
    const fractionalOpen = await shellApi.openReviewSession(
      openInput(fractional.port(KEY)),
    );
    if (fractionalOpen.kind !== "recovery_required")
      throw new Error(`expected recovery_required, got ${fractionalOpen.kind}`);
    expect(fractionalOpen.reason).toContain("taskRevision");
    expect(fractional.rawState(KEY).aggregateVersion).toBe(before.aggregateVersion);
    expect(fractional.rawState(KEY).replay).toHaveLength(before.replay.length);
    expect(fractional.rawState(KEY).receipts.size).toBe(before.receipts.size);

    // unsafe aggregate version
    const { port } = countingPort(() =>
      Promise.resolve({
        kind: "loaded",
        snapshot: {
          aggregateVersion: Number.MAX_SAFE_INTEGER + 1,
          taskRevision: 7,
          replay: [],
          receipts: [],
        },
      }),
    );
    const unsafeOpen = await shellApi.openReviewSession(openInput(port));
    if (unsafeOpen.kind !== "recovery_required")
      throw new Error(`expected recovery_required, got ${unsafeOpen.kind}`);
    expect(unsafeOpen.reason).toContain("aggregateVersion");

    // a loaded outcome claiming an aggregate that does not exist
    const { port: emptyLoadedPort } = countingPort(() =>
      Promise.resolve({
        kind: "loaded",
        snapshot: { aggregateVersion: 0, taskRevision: 7, replay: [], receipts: [] },
      }),
    );
    const emptyLoadedOpen = await shellApi.openReviewSession(
      openInput(emptyLoadedPort),
    );
    expect(emptyLoadedOpen.kind).toBe("recovery_required");
  });

  it("review-resume-restored — an incompatible stored version returns recovery_required with a non-empty reason and preserves stored data", async () => {
    const store = new FakeReviewStore();
    await persistRevision(store.port(KEY), KEY, 7);
    const persistedBefore = store.rawState(KEY);
    expect(persistedBefore.replay.length).toBeGreaterThan(0);

    store.setLoadOverride({
      kind: "recovery_required",
      reason: "unsupported schema version 99",
    });
    const reopened = await shellApi.openReviewSession(openInput(store.port(KEY)));
    if (reopened.kind !== "recovery_required")
      throw new Error(`expected recovery_required, got ${reopened.kind}`);
    expect(reopened.reason.length).toBeGreaterThan(0);

    const persistedAfter = store.rawState(KEY);
    expect(persistedAfter.aggregateVersion).toBe(persistedBefore.aggregateVersion);
    expect(persistedAfter.replay).toHaveLength(persistedBefore.replay.length);
    expect(persistedAfter.receipts.size).toBe(persistedBefore.receipts.size);
  });
});