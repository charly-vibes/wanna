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

type LedgerState = { active: string | null; durableWriteSucceeds: boolean };

function appendDurable(state: LedgerState, records: RevisionRecord[], record: RevisionRecord): boolean {
  if (!state.durableWriteSucceeds) return false;
  records.push(record);
  return true;
}

function ledgerFacade(
  state: LedgerState,
  records: RevisionRecord[],
  interrupted: InterruptedOperation[],
): RevisionLedger {
  return {
    get activeRevision() { return state.active; },
    get revisions() { return records; },
    get interruptedOperations() { return interrupted; },
    get durableWriteSucceeds() { return state.durableWriteSucceeds; },
    set durableWriteSucceeds(value: boolean) { state.durableWriteSucceeds = value; },
    revision: (id) => knownRecord(records, id),
    isKnown: (id) => records.some((r) => r.id === id),
    interrupt: (op) => {
      interrupted.push(op);
    },
    appendRecord: (record) => appendDurable(state, records, record),
    setActivePointer: (id) => {
      state.active = id;
    },
    markInterruptedOperations: () => markAllInterrupted(interrupted),
  };
}

export function createRevisionLedger(init: LedgerInit): RevisionLedger {
  const records: RevisionRecord[] = [...(init.records ?? [])];
  const interrupted: InterruptedOperation[] = [];
  const state = { active: init.activeRevision, durableWriteSucceeds: true };
  return ledgerFacade(state, records, interrupted);
}
