// Purpose: the atomic conditional commit for the durable review adapter
// Responsibilities: payload fingerprints, commit decisions (dedup, version and revision preconditions), aggregate application, and the main transaction that settles the pending record with the write
// Rationale: one transaction spans aggregates and pending so state/replay/receipt land or roll back together; concurrent operations from one base cannot both apply ([[review.workbench.adapter_conflicts_serialized]]).
// Spec: openspec/changes/add-workbench-spa/specs/review-workbench/spec.md
import type {
  AggregateSnapshot,
  PortOperation,
  PortReceipt,
  SessionTaskKey,
} from "../../../composition-shell";
import {
  AGGREGATE_STORE,
  PENDING_STORE,
  transactionDone,
  type IdbObjectStoreLike,
  type IdbTransactionLike,
} from "./storage";
import {
  aggregateId,
  isAggregateRecord,
  pendingId,
  type AggregateRecord,
  type IdbHandles,
  type StoredReceipt,
} from "./records";

/** Snapshot projected from stored data; never aliases mutable storage. */
export function snapshotOf(record: AggregateRecord): AggregateSnapshot {
  return structuredClone({
    aggregateVersion: record.aggregateVersion,
    taskRevision: record.taskRevision,
    replay: record.replay,
    receipts: Object.values(record.receipts).map(
      ({ operationId, applied }) => ({ operationId, applied }),
    ),
  });
}

export function publicReceipt(receipt: StoredReceipt): PortReceipt {
  return structuredClone({
    operationId: receipt.operationId,
    applied: receipt.applied,
  });
}

export type CommitDecision =
  | {
      readonly kind: "applied";
      readonly next: AggregateRecord;
      readonly receipt: PortReceipt;
      readonly snapshot: AggregateSnapshot;
    }
  | { readonly kind: "duplicate"; readonly receipt: PortReceipt }
  | { readonly kind: "conflict" };

/** Canonical fingerprint of an operation's identity-defining payload. */
export function fingerprintOf(operation: PortOperation): string {
  return JSON.stringify({
    expectedTaskRevision: operation.expectedTaskRevision,
    expectedInteractionRevision: operation.expectedInteractionRevision,
    stateChanges: operation.stateChanges,
    replayAdditions: operation.replayAdditions,
  });
}

export function decideCommit(
  stored: unknown,
  expectedVersion: number | null,
  operation: PortOperation,
  fingerprint: string,
): CommitDecision {
  const record = isAggregateRecord(stored) ? stored : undefined;
  if (stored !== undefined && record === undefined) return { kind: "conflict" };
  const receipt = record?.receipts[operation.operationId];
  if (receipt !== undefined) {
    return receipt.fingerprint === fingerprint
      ? { kind: "duplicate", receipt: publicReceipt(receipt) }
      : { kind: "conflict" };
  }
  if (!versionPreconditionMet(record, expectedVersion)) return { kind: "conflict" };
  if (!taskRevisionPreconditionMet(record, operation)) return { kind: "conflict" };
  return buildApplied(record, operation, fingerprint);
}

function versionPreconditionMet(
  record: AggregateRecord | undefined,
  expectedVersion: number | null,
): boolean {
  if (expectedVersion === null) return record === undefined;
  return record !== undefined && record.aggregateVersion === expectedVersion;
}

function taskRevisionPreconditionMet(
  record: AggregateRecord | undefined,
  operation: PortOperation,
): boolean {
  if (operation.expectedTaskRevision === null) return true;
  const current = record?.taskRevision ?? 0;
  return current === operation.expectedTaskRevision;
}

function buildApplied(
  stored: AggregateRecord | undefined,
  operation: PortOperation,
  fingerprint: string,
): CommitDecision {
  const next = applyOperation(stored, operation, fingerprint);
  const receipt: PortReceipt = { operationId: operation.operationId, applied: true };
  return { kind: "applied", next, receipt, snapshot: snapshotOf(next) };
}

export function applyOperation(
  stored: AggregateRecord | undefined,
  operation: PortOperation,
  fingerprint: string,
): AggregateRecord {
  const base: AggregateRecord = stored ?? {
    schemaVersion: 1,
    aggregateVersion: 0,
    taskRevision: 0,
    state: null,
    replay: [],
    receipts: {},
  };
  const receipts = { ...base.receipts };
  receipts[operation.operationId] = {
    operationId: operation.operationId,
    applied: true,
    fingerprint,
  };
  return structuredClone({
    schemaVersion: 1,
    aggregateVersion: base.aggregateVersion + 1,
    taskRevision: revisedTaskRevision(base, operation),
    state: operation.stateChanges,
    replay: [...base.replay, ...operation.replayAdditions],
    receipts,
  });
}

function revisedTaskRevision(
  record: AggregateRecord,
  operation: PortOperation,
): number {
  const changes = operation.stateChanges;
  if (typeof changes !== "object" || changes === null) return record.taskRevision;
  const revision = (changes as { taskRevision?: unknown }).taskRevision;
  return typeof revision === "number" && Number.isSafeInteger(revision)
    ? revision
    : record.taskRevision;
}

export function runMainCommit(
  handles: IdbHandles,
  key: SessionTaskKey,
  expectedVersion: number | null,
  operation: PortOperation,
  fingerprint: string,
): Promise<CommitDecision> {
  const tx = handles.db.transaction(
    [AGGREGATE_STORE, PENDING_STORE],
    "readwrite",
  );
  const decision = new Promise<CommitDecision>((resolve, reject) => {
    settleMainCommit(tx, resolve, reject, handles, key, expectedVersion, operation, fingerprint);
  });
  return Promise.all([decision, transactionDone(tx)]).then(
    ([outcome]) => outcome,
  );
}

function settleMainCommit(
  tx: IdbTransactionLike,
  resolve: (decision: CommitDecision) => void,
  reject: (error: Error) => void,
  handles: IdbHandles,
  key: SessionTaskKey,
  expectedVersion: number | null,
  operation: PortOperation,
  fingerprint: string,
): void {
  const aggregateStore = tx.objectStore(AGGREGATE_STORE);
  const pendingStore = tx.objectStore(PENDING_STORE);
  const getReq = aggregateStore.get(aggregateId(key));
  getReq.onsuccess = () => {
    const outcome = decideCommit(
      getReq.result,
      expectedVersion,
      operation,
      fingerprint,
    );
    if (outcome.kind !== "applied") {
      pendingStore.delete(pendingId(key, operation.operationId));
      resolve(outcome);
      return;
    }
    if (handles.hooks?.abortMainWrite?.(operation.operationId) === true) {
      reject(new Error("injected before-write failure"));
      tx.abort();
      return;
    }
    putApplied(aggregateStore, pendingStore, key, operation, outcome, resolve, reject);
  };
  getReq.onerror = () => reject(getReq.error ?? new Error("aggregate get failed"));
}

function putApplied(
  aggregateStore: IdbObjectStoreLike,
  pendingStore: IdbObjectStoreLike,
  key: SessionTaskKey,
  operation: PortOperation,
  outcome: CommitDecision & { kind: "applied" },
  resolve: (decision: CommitDecision) => void,
  reject: (error: Error) => void,
): void {
  const putReq = aggregateStore.put(outcome.next, aggregateId(key));
  putReq.onsuccess = () => {
    pendingStore.delete(pendingId(key, operation.operationId));
    resolve(outcome);
  };
  putReq.onerror = () => reject(putReq.error ?? new Error("aggregate put failed"));
}
