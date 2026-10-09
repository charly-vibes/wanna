// Purpose: pending-operation record writes for the durable review adapter
// Responsibilities: durably record pending identity before uncertain writes and settle aborts after caught rollbacks
// Rationale: a durable pending-operation record precedes every uncertain write so reconciliation can never infer no-effect from transient absence.
// Spec: openspec/changes/add-workbench-spa/design.md (Boundaries and storage)
import type { PortOperation, SessionTaskKey } from "../../../composition-shell";
import { PENDING_STORE, transactionDone } from "./storage";
import { pendingId, type IdbHandles, type PendingRecord } from "./records";
import { fingerprintOf } from "./commit";

export function pendingRecordFor(operation: PortOperation): PendingRecord {
  return {
    operationId: operation.operationId,
    fingerprint: fingerprintOf(operation),
    status: "pending",
  };
}

export async function writePending(
  handles: IdbHandles,
  key: SessionTaskKey,
  record: PendingRecord,
): Promise<void> {
  const tx = handles.db.transaction(PENDING_STORE, "readwrite");
  tx.objectStore(PENDING_STORE).put(record, pendingId(key, record.operationId));
  await transactionDone(tx);
}

/** Best-effort durable abort marker; false when the marker itself cannot land. */
export async function markPendingAborted(
  handles: IdbHandles,
  key: SessionTaskKey,
  record: PendingRecord,
): Promise<boolean> {
  const aborted: PendingRecord = { ...record, status: "aborted" };
  return writePending(handles, key, aborted)
    .then(() => true)
    .catch(() => false);
}
