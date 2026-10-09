// Purpose: authoritative reconciliation for the durable review adapter
// Responsibilities: resolve an operation's outcome over one transaction spanning both stores
// Rationale: a `pending` record with no receipt is insufficient proof of non-application — only a durably recorded abort or a settled receipt resolves the outcome ([[review.workbench.adapter_conflicts_serialized]] design).
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md (Uncertain commit reconciliation)
import type { PortReconcileOutcome, SessionTaskKey } from "../../../composition-shell";
import { AGGREGATE_STORE, PENDING_STORE, requestAsPromise, type IdbDatabaseLike } from "./storage";
import {
  aggregateId,
  isAggregateRecord,
  pendingId,
  type AggregateRecord,
  type PendingRecord,
} from "./records";
import { publicReceipt, snapshotOf } from "./commit";
import type { StoredReceipt } from "./records";

export function runReconcile(
  db: IdbDatabaseLike,
  key: SessionTaskKey,
  operationId: string,
): Promise<PortReconcileOutcome> {
  const tx = db.transaction([AGGREGATE_STORE, PENDING_STORE], "readonly");
  const aggregateRead = tx.objectStore(AGGREGATE_STORE).get(aggregateId(key));
  const pendingRead = tx.objectStore(PENDING_STORE).get(pendingId(key, operationId));
  return Promise.all([
    requestAsPromise(aggregateRead),
    requestAsPromise(pendingRead),
  ]).then(([stored, pending]) => decideReconcile(stored, pending, operationId));
}

export function decideReconcile(
  stored: unknown,
  pendingValue: unknown,
  operationId: string,
): PortReconcileOutcome {
  const record = isAggregateRecord(stored) ? stored : undefined;
  if (stored !== undefined && record === undefined) {
    return { kind: "unknown_effect" };
  }
  const receipt = record?.receipts[operationId];
  if (receipt !== undefined && record !== undefined) {
    return reconcileFromReceipt(record, receipt);
  }
  return resolveFromPending(pendingValue);
}

function reconcileFromReceipt(
  record: AggregateRecord,
  receipt: StoredReceipt,
): PortReconcileOutcome {
  return receipt.applied
    ? {
        kind: "applied",
        receipt: publicReceipt(receipt),
        snapshot: snapshotOf(record),
      }
    : { kind: "not_applied" };
}

function resolveFromPending(pendingValue: unknown): PortReconcileOutcome {
  const pending = pendingValue as PendingRecord | undefined;
  if (pending === undefined) return { kind: "not_applied" };
  return pending.status === "aborted"
    ? { kind: "not_applied" }
    : { kind: "unknown_effect" };
}
