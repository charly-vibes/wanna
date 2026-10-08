// Purpose: transition tests for the change-transaction model
// Responsibilities: every spec ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror the spec row for row; guards must fail with precise reasons
import { describe, it, expect } from "vitest";
import {
  bareCandidate,
  createTransaction,
  validationOnlyCandidate,
  advanceToAwaitingApproval,
  advanceToValidated,
  baseLedgerWithInterruptedIdempotent,
  baseLedgerWithInterruptedNonIdempotent,
} from "./fixtures";

describe("change-transaction transitions", () => {
  it("preview_change moves draft → previewed when base_revision_pinned holds", () => {
    const tx = createTransaction();
    const r = tx.fire("preview_change");
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("previewed");
  });

  it("preview_change refuses to fire when base_revision_pinned does not hold, naming the pin", () => {
    const unpinned = createTransaction({ baseRevision: null });
    const r = unpinned.fire("preview_change");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("base_revision_pinned does not hold: transaction has no pinned base revision");
    expect(unpinned.state).toBe("draft");

    const unknownBase = createTransaction({ baseRevision: "rev-404" });
    const r2 = unknownBase.fire("preview_change");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("base_revision_pinned does not hold: pinned base revision rev-404 is not a known revision");
    expect(unknownBase.state).toBe("draft");
  });

  it("validate_change moves previewed → validated when validation_evidence_retained holds", () => {
    const tx = createTransaction();
    tx.fire("preview_change");
    const r = tx.fire("validate_change");
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("validated");
  });

  it("validate_change refuses to fire when validation_evidence_retained does not hold, naming the missing evidence", () => {
    // candidate with no evidence at all — validation retains no report
    const tx = createTransaction({ candidate: bareCandidate() });
    tx.fire("preview_change");
    const r = tx.fire("validate_change");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("validation_evidence_retained does not hold: candidate retains no validation evidence");
    expect(tx.state).toBe("previewed");
  });

  it("request_approval moves validated → awaiting_approval when commit_atomic holds", () => {
    const tx = createTransaction();
    advanceToValidated(tx);
    const r = tx.fire("request_approval");
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("awaiting_approval");
  });

  it("request_approval refuses to fire when commit_atomic does not hold", () => {
    const tx = createTransaction({ candidate: { id: "", evidence: { validation: ["v-1"], test: ["t-1"], safety: ["s-1"] } } });
    advanceToValidated(tx);
    const r = tx.fire("request_approval");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("commit_atomic does not hold: candidate revision has no durable identity");
    expect(tx.state).toBe("validated");
  });

  it("commit_change moves awaiting_approval → committed when optimistic_conflict_checked holds", () => {
    const tx = createTransaction();
    advanceToAwaitingApproval(tx);
    const r = tx.fire("commit_change", { approvalRefs: ["appr-1"] });
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("committed");
    expect(tx.ledger.activeRevision).toBe("rev-2");
    expect(tx.ledger.revision("rev-2")).not.toBeNull();
  });

  it("commit_change refuses to fire when optimistic_conflict_checked does not hold, naming the conflict", () => {
    const tx = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(tx);
    const r = tx.fire("commit_change", { approvalRefs: ["appr-1"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "optimistic_conflict_checked does not hold: active revision rev-9 does not match transaction base revision rev-1; no explicit rebase provided",
    );
    expect(tx.ledger.activeRevision).toBe("rev-9");
  });

  it("commit_change succeeds after an explicit rebase satisfies optimistic_conflict_checked", () => {
    const tx = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(tx);
    const r = tx.fire("commit_change", { approvalRefs: ["appr-1"], rebaseTo: "rev-9" });
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("committed");
    expect(tx.ledger.revision("rev-2")!.parent).toBe("rev-9");
  });

  it("reject_change moves validated → rejected when validation_evidence_retained does not hold", () => {
    const tx = createTransaction({ candidate: validationOnlyCandidate() });
    advanceToValidated(tx);
    const r = tx.fire("reject_change");
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("rejected");
  });

  it("reject_change refuses to fire when validation_evidence_retained holds", () => {
    const tx = createTransaction();
    advanceToValidated(tx);
    const r = tx.fire("reject_change");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reject_change requires validation_evidence_retained to fail; candidate retains validation, test, and safety evidence");
    expect(tx.state).toBe("validated");
  });

  it("detect_revision_conflict moves awaiting_approval → conflicted when optimistic_conflict_checked does not hold", () => {
    const tx = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(tx);
    const r = tx.fire("detect_revision_conflict");
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("conflicted");
  });

  it("detect_revision_conflict refuses to fire when optimistic_conflict_checked holds", () => {
    const tx = createTransaction();
    advanceToAwaitingApproval(tx);
    const r = tx.fire("detect_revision_conflict");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("detect_revision_conflict requires optimistic_conflict_checked to fail; active revision matches the transaction base revision");
    expect(tx.state).toBe("awaiting_approval");
  });

  it("recover_interrupted_change moves conflicted → recovered when inflight_operations_not_replayed holds", () => {
    const tx = createTransaction({ ledger: baseLedgerWithInterruptedIdempotent() });
    advanceToAwaitingApproval(tx);
    tx.fire("detect_revision_conflict");
    const r = tx.fire("recover_interrupted_change", { recoveryPolicy: { kind: "replay" } });
    expect(r.ok).toBe(true);
    expect(tx.state).toBe("recovered");
    expect(tx.ledger.interruptedOperations.every((op) => op.status === "marked")).toBe(true);
  });

  it("recover_interrupted_change refuses to fire when inflight_operations_not_replayed does not hold, naming the effect", () => {
    const tx = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(tx);
    tx.fire("detect_revision_conflict");
    const r = tx.fire("recover_interrupted_change", { recoveryPolicy: { kind: "replay" } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("inflight_operations_not_replayed does not hold: recovery policy replay would re-run non-idempotent effect eff-1");
    expect(tx.state).toBe("conflicted");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const tx = createTransaction();
    // validate_change starts at previewed, not draft
    const r = tx.fire("validate_change");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition validate_change cannot fire from state draft");
    expect(tx.state).toBe("draft");
  });
});
