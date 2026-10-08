// Purpose: test fixtures for the change-transaction layer
// Responsibilities: build canonical ledgers, candidates, and transactions the corpus properties name
// Rationale: single source of shared revision vocabulary for transitions and properties tests
import { createRevisionLedger } from "../../src/change-transaction/revisions";
import type { RevisionLedger } from "../../src/change-transaction/revisions";
import { createChangeTransaction } from "../../src/change-transaction/machine";
import type {
  CandidateRevision,
  TransactionInit,
} from "../../src/change-transaction/types";

export const BASE = "rev-1";

export function baseLedger(): RevisionLedger {
  return createRevisionLedger({
    records: [
      { id: BASE, parent: null, restoredFrom: null, evidence: null, migration: null, status: "accepted" },
    ],
    activeRevision: BASE,
  });
}

export function conflictingLedger(): RevisionLedger {
  return createRevisionLedger({
    records: [
      { id: BASE, parent: null, restoredFrom: null, evidence: null, migration: null, status: "accepted" },
      { id: "rev-9", parent: BASE, restoredFrom: null, evidence: null, migration: null, status: "accepted" },
    ],
    activeRevision: "rev-9",
  });
}

export function baseLedgerWithInterruptedNonIdempotent(): RevisionLedger {
  const ledger = conflictingLedger();
  ledger.interrupt({ id: "op-1", effectId: "eff-1", idempotent: false, status: "interrupted" });
  return ledger;
}

export function baseLedgerWithInterruptedIdempotent(): RevisionLedger {
  const ledger = conflictingLedger();
  ledger.interrupt({ id: "op-2", effectId: "eff-2", idempotent: true, status: "interrupted" });
  return ledger;
}

export function evidencedCandidate(id = "rev-2"): CandidateRevision {
  return {
    id,
    evidence: { validation: ["v-1"], test: ["t-1"], safety: ["s-1"] },
  };
}

export function validationOnlyCandidate(id = "rev-2"): CandidateRevision {
  return { id, evidence: { validation: ["v-1"] } };
}

export function bareCandidate(id = "rev-2"): CandidateRevision {
  return { id };
}

export function createTransaction(overrides: Partial<TransactionInit> = {}) {
  const init: TransactionInit = {
    id: "tx-1",
    baseRevision: BASE,
    ledger: baseLedger(),
    candidate: evidencedCandidate(),
    ...overrides,
  };
  return createChangeTransaction(init);
}

export function advanceToValidated(tx: ReturnType<typeof createTransaction>): void {
  tx.fire("preview_change");
  tx.fire("validate_change");
}

export function advanceToAwaitingApproval(tx: ReturnType<typeof createTransaction>): void {
  advanceToValidated(tx);
  tx.fire("request_approval");
}
