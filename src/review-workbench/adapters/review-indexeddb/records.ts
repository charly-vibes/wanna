// Purpose: records and fault-injection contract for the durable review adapter
// Responsibilities: stored record shapes, fault hooks at the adapter's real boundaries, and adapter options
// Rationale: fault injection (before-write failure, lost acknowledgement, unresolved abandonment) is test-only and lives at actual adapter boundaries per the design.
// Spec: openspec/changes/add-workbench-spa/design.md (Boundaries and storage)
import type { PortReceipt, SessionTaskKey } from "../../../composition-shell";
import type { IdbDatabaseLike } from "./storage";
import { SCHEMA_VERSION } from "./storage";

/** Stored proof that an operation was applied, with the payload fingerprint that guards reuse. */
export interface StoredReceipt extends PortReceipt {
  readonly fingerprint: string;
}

/** Full aggregate record: one object-store entry makes state, replay and receipts one atomic unit. */
export interface AggregateRecord {
  readonly schemaVersion: number;
  readonly aggregateVersion: number;
  readonly taskRevision: number;
  readonly state: unknown;
  readonly replay: readonly unknown[];
  readonly receipts: Readonly<Record<string, StoredReceipt>>;
}

/** Durable pending-operation identity, written before any uncertain attempt. */
export interface PendingRecord {
  readonly operationId: string;
  readonly fingerprint: string;
  readonly status: "pending" | "aborted";
}

/**
 * Fault injection at the adapter's real boundaries, for contract and
 * acceptance tests only: before-write failure, after-commit lost
 * acknowledgement, and unresolved pending abandonment.
 */
export interface ReviewIndexDbFaultHooks {
  loseAckFor?(operationId: string): boolean;
  abortMainWrite?(operationId: string): boolean;
  abandonAfterPending?(operationId: string): boolean;
}

export interface ReviewIndexDbAdapterOptions {
  /** The IDB factory backing storage; hosts pass the platform global, tests inject an isolated one. */
  readonly indexedDB: unknown;
  readonly databaseName?: string;
  readonly hooks?: ReviewIndexDbFaultHooks;
}

export interface IdbHandles {
  readonly db: IdbDatabaseLike;
  readonly hooks?: ReviewIndexDbFaultHooks;
}

export function aggregateId(key: SessionTaskKey): string {
  return `${key.sessionId}/${key.taskId}`;
}

export function pendingId(key: SessionTaskKey, operationId: string): string {
  return `${key.sessionId}/${key.taskId}/${operationId}`;
}

export function isAggregateRecord(value: unknown): value is AggregateRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<AggregateRecord>;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    typeof record.aggregateVersion === "number" &&
    typeof record.taskRevision === "number" &&
    Array.isArray(record.replay) &&
    typeof record.receipts === "object" &&
    record.receipts !== null
  );
}
