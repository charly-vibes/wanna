// Purpose: the durable IndexedDB ReviewPersistencePort for the artifact-review workbench (wanna-snh)
// Responsibilities: bind one session/task key to storage, run load/conditional-commit/reconcile through the storage, commit and reconcile modules, and report honest typed outcomes
// Rationale: the port owns storage serialization; every uncertain write is preceded by a durable pending-operation record so reconciliation can never lose the operation identity — across connections and restarts.
// Spec: openspec/changes/add-workbench-spa/design.md (Boundaries and storage)
import type {
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  PortReconcileOutcome,
  ReviewPersistencePort,
  SessionTaskKey,
} from "../../../composition-shell";
import { DEFAULT_REVIEW_DB_NAME, openDatabase } from "./storage";
import {
  markPendingAborted,
  pendingRecordFor,
  writePending,
} from "./pending-writes";
import { runMainCommit, snapshotOf, type CommitDecision } from "./commit";
import { runReconcile } from "./reconcile";
import { aggregateId, isAggregateRecord, type IdbHandles, type ReviewIndexDbAdapterOptions } from "./records";
import { requestAsPromise, AGGREGATE_STORE } from "./storage";

export { type ReviewIndexDbAdapterOptions, type ReviewIndexDbFaultHooks } from "./records";

/**
 * Opens (or reuses) the durable review database and returns a
 * [[ReviewPersistencePort]] bound to one session/task key. Fault hooks are
 * test-only injections at the adapter's real boundaries.
 */
export async function createReviewIndexDbPort(
  options: ReviewIndexDbAdapterOptions,
  key: SessionTaskKey,
): Promise<ReviewPersistencePort> {
  const handles: IdbHandles = {
    db: await openDatabase(
      options.indexedDB as Parameters<typeof openDatabase>[0],
      options.databaseName ?? DEFAULT_REVIEW_DB_NAME,
    ),
    hooks: options.hooks,
  };
  return {
    supportsAtomicCommitAndReplay: true,
    deduplicationScope: new Set([key.sessionId]),
    load: (portKey) => loadAggregate(handles, portKey),
    compareAndCommit: (portKey, expectedVersion, operation) =>
      conditionalCommit(handles, portKey, expectedVersion, operation),
    reconcile: (portKey, operationId) =>
      reconcileOperation(handles, portKey, operationId),
  };
}

export async function loadAggregate(
  handles: IdbHandles,
  key: SessionTaskKey,
): Promise<PortLoadOutcome> {
  try {
    const tx = handles.db.transaction(AGGREGATE_STORE, "readonly");
    const stored = await requestAsPromise(
      tx.objectStore(AGGREGATE_STORE).get(aggregateId(key)),
    );
    if (stored === undefined) return { kind: "not_found" };
    if (!isAggregateRecord(stored)) return corruptLoadOutcome();
    return { kind: "loaded", snapshot: snapshotOf(stored) };
  } catch (error) {
    return { kind: "unavailable", reason: String(error) };
  }
}

function corruptLoadOutcome(): PortLoadOutcome {
  return {
    kind: "recovery_required",
    reason: "stored review data has an unsupported schema or corrupt shape",
  };
}

async function conditionalCommit(
  handles: IdbHandles,
  key: SessionTaskKey,
  expectedVersion: number | null,
  operation: PortOperation,
): Promise<PortCommitOutcome> {
  const pending = pendingRecordFor(operation);
  if (handles.hooks?.abandonAfterPending?.(operation.operationId) === true) {
    await writePending(handles, key, pending);
    return { kind: "unknown_effect" };
  }
  try {
    await writePending(handles, key, pending);
  } catch {
    // the pending identity did not land: no write was attempted
    return { kind: "unavailable" };
  }
  return settleConditionalCommit(handles, key, expectedVersion, operation, pending);
}

async function settleConditionalCommit(
  handles: IdbHandles,
  key: SessionTaskKey,
  expectedVersion: number | null,
  operation: PortOperation,
  pending: ReturnType<typeof pendingRecordFor>,
): Promise<PortCommitOutcome> {
  try {
    const decision = await runMainCommit(
      handles,
      key,
      expectedVersion,
      operation,
      pending.fingerprint,
    );
    return mapDecision(decision, handles, operation.operationId);
  } catch {
    // the transaction rolled back: certain no effect if the abort can be
    // durably recorded; otherwise the effect stays genuinely unknown
    const recorded = await markPendingAborted(handles, key, pending);
    return recorded ? { kind: "unavailable" } : { kind: "unknown_effect" };
  }
}

function mapDecision(
  decision: CommitDecision,
  handles: IdbHandles,
  operationId: string,
): PortCommitOutcome {
  if (
    decision.kind === "applied" &&
    handles.hooks?.loseAckFor?.(operationId) === true
  ) {
    return { kind: "unknown_effect" };
  }
  return decision;
}

async function reconcileOperation(
  handles: IdbHandles,
  key: SessionTaskKey,
  operationId: string,
): Promise<PortReconcileOutcome> {
  try {
    return await runReconcile(handles.db, key, operationId);
  } catch {
    return { kind: "unknown_effect" };
  }
}
