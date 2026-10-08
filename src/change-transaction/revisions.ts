// Purpose: the revision ledger for the change-transaction layer
// Responsibilities: durable revision records, the atomic active-revision pointer, and the interrupted-operations journal
// Rationale: the active pointer only ever moves after its durable revision record has been written
import type {
  InterruptedOperation,
  RevisionRecord,
} from "./types";

export interface RevisionLedger {
  readonly activeRevision: string | null;
  readonly revisions: readonly RevisionRecord[];
  readonly interruptedOperations: readonly InterruptedOperation[];
  durableWriteSucceeds: boolean;
  revision(id: string): RevisionRecord | null;
  isKnown(id: string): boolean;
  interrupt(op: InterruptedOperation): void;
  appendRecord(record: RevisionRecord): boolean;
  setActivePointer(id: string): void;
  markInterruptedOperations(): void;
}

export interface LedgerInit {
  readonly records?: readonly RevisionRecord[];
  readonly activeRevision: string | null;
}

function knownRecord(records: readonly RevisionRecord[], id: string): RevisionRecord | null {
  return records.find((r) => r.id === id) ?? null;
}

function markAllInterrupted(operations: readonly InterruptedOperation[]): void {
  for (const op of operations) {
    op.status = "marked";
  }
}

export function createRevisionLedger(init: LedgerInit): RevisionLedger {
  const records: RevisionRecord[] = [...(init.records ?? [])];
  const interrupted: InterruptedOperation[] = [];
  let active = init.activeRevision;
  let durableWriteSucceeds = true;
  return {
    get activeRevision() {
      return active;
    },
    get revisions() {
      return records;
    },
    get interruptedOperations() {
      return interrupted;
    },
    get durableWriteSucceeds() {
      return durableWriteSucceeds;
    },
    set durableWriteSucceeds(value: boolean) {
      durableWriteSucceeds = value;
    },
    revision: (id) => knownRecord(records, id),
    isKnown: (id) => knownRecord(records, id) !== null,
    interrupt: (op) => {
      interrupted.push(op);
    },
    appendRecord: (record) => {
      if (!durableWriteSucceeds) return false;
      records.push(record);
      return true;
    },
    setActivePointer: (id) => {
      active = id;
    },
    markInterruptedOperations: () => markAllInterrupted(interrupted),
  };
}
