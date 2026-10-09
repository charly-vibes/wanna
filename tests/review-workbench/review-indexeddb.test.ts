// Purpose: contract tests for the durable IndexedDB review adapter (wanna-snh)
// Responsibilities: prove atomic conditional commits, cross-connection serialization, deduplication across reopen, and honest reconcile outcomes against real IndexedDB semantics (fake-indexeddb) at actual adapter boundaries
// Spec: openspec/changes/add-workbench-spa/specs/review-workbench/spec.md ([[review.workbench.adapter_conflicts_serialized]])
import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type {
  AggregateSnapshot,
  PortOperation,
  ReviewPersistencePort,
  SessionTaskKey,
} from "../../src/composition-shell";
import {
  createReviewIndexDbPort,
  type ReviewIndexDbFaultHooks,
} from "../../src/review-workbench/adapters/review-indexeddb";

const KEY: SessionTaskKey = { sessionId: "session-1", taskId: "artifact-1" };

function openPort(
  factory: IDBFactory,
  key: SessionTaskKey = KEY,
  hooks?: ReviewIndexDbFaultHooks,
): Promise<ReviewPersistencePort> {
  return createReviewIndexDbPort({ indexedDB: factory, hooks }, key);
}

function operation(
  operationId: string,
  stateChanges: unknown = { reviewOpened: { id: operationId } },
  expectedTaskRevision: number | null = null,
): PortOperation {
  return {
    operationId,
    expectedTaskRevision,
    expectedInteractionRevision: null,
    stateChanges,
    replayAdditions: [stateChanges],
  };
}

async function loadSnapshot(
  port: ReviewPersistencePort,
): Promise<AggregateSnapshot> {
  const outcome = await port.load(KEY);
  if (outcome.kind !== "loaded") {
    throw new Error(`expected loaded, got ${outcome.kind}`);
  }
  return outcome.snapshot;
}

describe("review-indexeddb adapter", () => {
  it("reports a declared atomic port scoped to the session", async () => {
    const port = await openPort(new IDBFactory());
    expect(port.supportsAtomicCommitAndReplay).toBe(true);
    expect([...port.deduplicationScope]).toEqual([KEY.sessionId]);
  });

  it("load on an empty scope is not_found", async () => {
    const port = await openPort(new IDBFactory());
    expect(await port.load(KEY)).toEqual({ kind: "not_found" });
  });

  it("creation commit applies and a second creation conflicts", async () => {
    const port = await openPort(new IDBFactory());
    const applied = await port.compareAndCommit(KEY, null, operation("op-1"));
    if (applied.kind !== "applied") throw new Error(`${applied.kind}`);
    expect(applied.snapshot.aggregateVersion).toBe(1);
    expect(applied.receipt).toEqual({ operationId: "op-1", applied: true });

    const second = await port.compareAndCommit(KEY, null, operation("op-2"));
    expect(second).toEqual({ kind: "conflict" });
    expect((await loadSnapshot(port)).aggregateVersion).toBe(1);
  });

  it("a stale expected version conflicts without mutation", async () => {
    const port = await openPort(new IDBFactory());
    await port.compareAndCommit(KEY, null, operation("op-1"));
    const stale = await port.compareAndCommit(KEY, 0, operation("op-2"));
    expect(stale).toEqual({ kind: "conflict" });
    const snapshot = await loadSnapshot(port);
    expect(snapshot.aggregateVersion).toBe(1);
    expect(snapshot.replay).toHaveLength(1);
  });

  it("a matching expected version applies with incremented version", async () => {
    const port = await openPort(new IDBFactory());
    await port.compareAndCommit(KEY, null, operation("op-1"));
    const applied = await port.compareAndCommit(
      KEY,
      1,
      operation("op-2", { reviewCompleted: { id: "op-2" } }),
    );
    if (applied.kind !== "applied") throw new Error(`${applied.kind}`);
    expect(applied.snapshot.aggregateVersion).toBe(2);
    expect(applied.snapshot.replay).toHaveLength(2);
    expect(applied.snapshot.receipts).toHaveLength(2);
  });

  it("independent connections from one base cannot both apply", async () => {
    const factory = new IDBFactory();
    const a = await openPort(factory);
    const b = await openPort(factory);
    // a shared warm-up so both connections start from the same stored base
    await a.compareAndCommit(KEY, null, operation("seed"));
    const appliedA = await a.compareAndCommit(KEY, 1, operation("op-a"));
    const appliedB = await b.compareAndCommit(KEY, 1, operation("op-b"));
    expect(appliedA.kind === "applied" || appliedA.kind === "conflict").toBe(
      true,
    );
    if (appliedA.kind === "applied") {
      expect(appliedB).toEqual({ kind: "conflict" });
    } else {
      if (appliedB.kind !== "applied") throw new Error(`${appliedB.kind}`);
      expect(appliedB.snapshot.aggregateVersion).toBe(2);
    }
    const snapshot = await loadSnapshot(a);
    expect(snapshot.aggregateVersion).toBe(2);
    expect(snapshot.replay).toHaveLength(2);
  });

  it("a committed operation id delivered again is a duplicate without reapplication", async () => {
    const factory = new IDBFactory();
    const a = await openPort(factory);
    const b = await openPort(factory);
    await a.compareAndCommit(KEY, null, operation("op-1"));
    await b.compareAndCommit(KEY, 1, operation("op-2"));
    const duplicate = await b.compareAndCommit(KEY, 1, operation("op-1"));
    if (duplicate.kind !== "duplicate") throw new Error(`${duplicate.kind}`);
    expect(duplicate.receipt).toEqual({ operationId: "op-1", applied: true });
    const snapshot = await loadSnapshot(b);
    expect(snapshot.aggregateVersion).toBe(2);
    expect(snapshot.replay).toHaveLength(2);
  });

  it("reuse of an operation id with a different payload is rejected", async () => {
    const port = await openPort(new IDBFactory());
    await port.compareAndCommit(KEY, null, operation("op-1", { a: 1 }));
    const reused = await port.compareAndCommit(KEY, 1, operation("op-1", { a: 2 }));
    expect(reused.kind).toBe("conflict");
    const snapshot = await loadSnapshot(port);
    expect(snapshot.replay).toHaveLength(1);
  });

  it("reopening a connection preserves aggregate, replay and receipts", async () => {
    const factory = new IDBFactory();
    const first = await openPort(factory);
    await first.compareAndCommit(KEY, null, operation("op-1"));
    await first.compareAndCommit(KEY, 1, operation("op-2"));
    // both connections closed; storage persists
    const reopened = await openPort(factory);
    const snapshot = await loadSnapshot(reopened);
    expect(snapshot.aggregateVersion).toBe(2);
    expect(snapshot.replay).toHaveLength(2);
    expect(snapshot.receipts).toEqual([
      { operationId: "op-1", applied: true },
      { operationId: "op-2", applied: true },
    ]);
  });

  it("a returned snapshot does not alias stored data", async () => {
    const port = await openPort(new IDBFactory());
    await port.compareAndCommit(KEY, null, operation("op-1"));
    const snapshot = await loadSnapshot(port);
    (snapshot.replay as unknown[]).push("tampered");
    const reloaded = await loadSnapshot(port);
    expect(reloaded.replay).toHaveLength(1);
  });

  it("lost acknowledgement is unknown_effect and reconciles to applied", async () => {
    const factory = new IDBFactory();
    const hooks: ReviewIndexDbFaultHooks = {
      loseAckFor: (operationId) => operationId === "op-1",
    };
    const port = await openPort(factory, KEY, hooks);
    const lost = await port.compareAndCommit(KEY, null, operation("op-1"));
    expect(lost).toEqual({ kind: "unknown_effect" });
    // the write landed durably despite the lost acknowledgement
    expect((await loadSnapshot(port)).aggregateVersion).toBe(1);
    const reconciled = await port.reconcile(KEY, "op-1");
    if (reconciled.kind !== "applied") throw new Error(`${reconciled.kind}`);
    expect(reconciled.receipt).toEqual({ operationId: "op-1", applied: true });
    expect(reconciled.snapshot.aggregateVersion).toBe(1);
    // a second delivery after reconciliation cannot apply again
    const duplicate = await port.compareAndCommit(KEY, 1, operation("op-1"));
    expect(duplicate.kind).toBe("duplicate");
  });

  it("a before-write failure is unavailable with certain no effect", async () => {
    const factory = new IDBFactory();
    const hooks: ReviewIndexDbFaultHooks = {
      abortMainWrite: () => true,
    };
    const port = await openPort(factory, KEY, hooks);
    const failed = await port.compareAndCommit(KEY, null, operation("op-1"));
    expect(failed).toEqual({ kind: "unavailable" });
    expect(await port.load(KEY)).toEqual({ kind: "not_found" });
    // the abort is durably recorded: reconciliation proves non-application
    expect(await port.reconcile(KEY, "op-1")).toEqual({ kind: "not_applied" });
  });

  it("unresolved pending identity survives restart and is never inferred as no-effect", async () => {
    const factory = new IDBFactory();
    const hooks: ReviewIndexDbFaultHooks = {
      abandonAfterPending: () => true,
    };
    const first = await openPort(factory, KEY, hooks);
    const abandoned = await first.compareAndCommit(KEY, null, operation("op-1"));
    expect(abandoned).toEqual({ kind: "unknown_effect" });
    // a later operation commits normally: the abandoned one stays unresolved
    const second = await openPort(factory);
    await second.compareAndCommit(KEY, null, operation("op-2"));
    // transient receipt absence is insufficient proof — before and after restart
    expect(await first.reconcile(KEY, "op-1")).toEqual({
      kind: "unknown_effect",
    });
    expect(await second.reconcile(KEY, "op-1")).toEqual({
      kind: "unknown_effect",
    });
  });

  it("corrupt or incompatible storage is recovery_required and preserved", async () => {
    const factory = new IDBFactory();
    const port = await openPort(factory);
    // write an incompatible record directly through a raw connection
    const raw = factory.open("wanna-review");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      raw.onsuccess = () => resolve(raw.result);
      raw.onerror = () => reject(raw.error);
    });
    const tx = db.transaction("aggregates", "readwrite");
    tx.objectStore("aggregates").put(
      { schemaVersion: 999, junk: true },
      `${KEY.sessionId}/${KEY.taskId}`,
    );
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    const outcome = await port.load(KEY);
    expect(outcome.kind).toBe("recovery_required");
    if (outcome.kind === "recovery_required") {
      expect(outcome.reason).toBeTruthy();
    }
    // the stored data is preserved, not reset
    const check = factory.open("wanna-review");
    const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
      check.onsuccess = () => resolve(check.result);
      check.onerror = () => reject(check.error);
    });
    const read = reopened
      .transaction("aggregates")
      .objectStore("aggregates")
      .get(`${KEY.sessionId}/${KEY.taskId}`);
    const stored = await new Promise<unknown>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    expect(stored).toEqual({ schemaVersion: 999, junk: true });
    reopened.close();
  });

  it("an explicit task-revision precondition is enforced authoritatively", async () => {
    const port = await openPort(new IDBFactory());
    await port.compareAndCommit(
      KEY,
      null,
      operation("op-1", { taskRevision: 7, contentRef: "ref-1" }),
    );
    const mismatched = await port.compareAndCommit(
      KEY,
      1,
      operation("op-2", { reviewOpened: { id: "op-2" } }, 6),
    );
    expect(mismatched).toEqual({ kind: "conflict" });
    const matched = await port.compareAndCommit(
      KEY,
      1,
      operation("op-2", { reviewOpened: { id: "op-2" } }, 7),
    );
    expect(matched.kind).toBe("applied");
  });
});
