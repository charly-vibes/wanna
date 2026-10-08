// Purpose: property tests for the change-transaction layer
// Responsibilities: each corpus property of change-transaction as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/change-transaction/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  advanceToAwaitingApproval,
  advanceToValidated,
  baseLedger,
  baseLedgerWithInterruptedIdempotent,
  baseLedgerWithInterruptedNonIdempotent,
  bareCandidate,
  BASE,
  createTransaction,
  evidencedCandidate,
  validationOnlyCandidate,
} from "./fixtures";

describe("change-transaction properties", () => {
  it("TypeScript conformance test: assert invariant base_revision_pinned at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: no transaction leaves draft without pinning a known base revision
    const unpinned = createTransaction({ baseRevision: null });
    expect(unpinned.fire("preview_change").reason).toBe(
      "base_revision_pinned does not hold: transaction has no pinned base revision",
    );
    const emptyBase = createTransaction({ baseRevision: "" });
    expect(emptyBase.fire("preview_change").reason).toBe(
      "base_revision_pinned does not hold: transaction has no pinned base revision",
    );
    const unknownBase = createTransaction({ baseRevision: "rev-404" });
    expect(unknownBase.fire("preview_change").reason).toBe(
      "base_revision_pinned does not hold: pinned base revision rev-404 is not a known revision",
    );
    // canonical operation: the pinned base revision is the parent of the committed revision
    const tx = createTransaction();
    advanceToAwaitingApproval(tx);
    expect(tx.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(true);
    expect(tx.ledger.revision("rev-2")!.parent).toBe(BASE);
  });

  it("TypeScript conformance test: assert invariant optimistic_conflict_checked at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: commit succeeds only if the active revision still matches the base
    const conflicting = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(conflicting);
    const r = conflicting.fire("commit_change", { approvalRefs: ["appr-1"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "optimistic_conflict_checked does not hold: active revision rev-9 does not match transaction base revision rev-1; no explicit rebase provided",
    );
    expect(conflicting.ledger.activeRevision).toBe("rev-9");
    // an explicit rebase to a known revision satisfies the check
    const rebased = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(rebased);
    expect(rebased.fire("commit_change", { approvalRefs: ["appr-1"], rebaseTo: "rev-9" }).ok).toBe(true);
    expect(rebased.ledger.activeRevision).toBe("rev-2");
    // a rebase to an unknown revision does not succeed
    const badRebase = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(badRebase);
    expect(badRebase.fire("commit_change", { approvalRefs: ["appr-1"], rebaseTo: "rev-404" }).reason).toBe(
      "optimistic_conflict_checked does not hold: active revision rev-9 does not match transaction base revision rev-1; explicit rebase to rev-404 failed: rebase target is not a known revision",
    );
  });

  it("TypeScript conformance test: assert invariant commit_atomic at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the active pointer changes atomically with the durable revision record
    const flaky = createTransaction();
    advanceToAwaitingApproval(flaky);
    flaky.ledger.durableWriteSucceeds = false;
    const r = flaky.fire("commit_change", { approvalRefs: ["appr-1"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("commit_atomic does not hold: durable revision record write failed; active pointer unchanged");
    expect(flaky.ledger.activeRevision).toBe(BASE);
    expect(flaky.ledger.revisions).toHaveLength(1); // no partial record landed
    // durable write succeeds: record and pointer land together
    const solid = createTransaction();
    advanceToAwaitingApproval(solid);
    expect(solid.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(true);
    expect(solid.ledger.activeRevision).toBe("rev-2");
    expect(solid.ledger.revision("rev-2")).not.toBeNull();
    expect(solid.state).toBe("committed");
  });

  it("TypeScript conformance test: assert invariant validation_evidence_retained at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the committed revision records validation, test, safety, and approval evidence
    const tx = createTransaction();
    advanceToAwaitingApproval(tx);
    expect(tx.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(true);
    const evidence = tx.ledger.revision("rev-2")!.evidence!;
    expect(evidence.validation).toEqual(["v-1"]);
    expect(evidence.test).toEqual(["t-1"]);
    expect(evidence.safety).toEqual(["s-1"]);
    expect(evidence.approval).toEqual(["appr-1"]);
    // an incomplete bundle is refused at its trust boundary — the committed revision
    const partial = createTransaction({ candidate: { id: "rev-2", evidence: { validation: ["v-1"] } } });
    advanceToAwaitingApproval(partial);
    expect(partial.fire("commit_change", { approvalRefs: ["appr-1"] }).reason).toBe(
      "validation_evidence_retained does not hold: committed revision is missing evidence kind(s): test, safety",
    );
    expect(partial.ledger.activeRevision).toBe(BASE);
    // a candidate retaining no validation evidence never reaches validated
    const empty = createTransaction({ candidate: bareCandidate() });
    empty.fire("preview_change");
    expect(empty.fire("validate_change").reason).toBe(
      "validation_evidence_retained does not hold: candidate retains no validation evidence",
    );
    // a commit without approval evidence is refused
    const noApproval = createTransaction();
    advanceToAwaitingApproval(noApproval);
    const r2 = noApproval.fire("commit_change", { approvalRefs: [] });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("validation_evidence_retained does not hold: commit records no approval evidence");
    expect(noApproval.ledger.activeRevision).toBe(BASE);
  });

  it("TypeScript conformance test: assert invariant failed_commit_preserves_active at its trust boundary and under its stated edge cases.", () => {
    // a rejected transaction leaves the active revision unchanged
    const rejected = createTransaction({ candidate: validationOnlyCandidate() });
    advanceToValidated(rejected);
    expect(rejected.fire("reject_change").ok).toBe(true);
    expect(rejected.state).toBe("rejected");
    expect(rejected.ledger.activeRevision).toBe(BASE);
    expect(rejected.ledger.revisions).toHaveLength(1);
    // a conflicted (failed) transaction leaves the active revision unchanged
    const conflicted = createTransaction({ ledger: baseLedgerWithInterruptedNonIdempotent() });
    advanceToAwaitingApproval(conflicted);
    expect(conflicted.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(false);
    expect(conflicted.fire("detect_revision_conflict").ok).toBe(true);
    expect(conflicted.state).toBe("conflicted");
    expect(conflicted.ledger.activeRevision).toBe("rev-9");
    expect(conflicted.ledger.revisions).toHaveLength(2);
  });

  it("TypeScript conformance test: assert invariant rollback_is_new_revision at its trust boundary and under its stated edge cases.", () => {
    // build intervening history: rev-1 → rev-2 → rev-3
    const ledger = baseLedger();
    const tx1 = createTransaction({ ledger });
    advanceToAwaitingApproval(tx1);
    expect(tx1.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(true);
    const tx2 = createTransaction({ id: "tx-2", baseRevision: "rev-2", ledger, candidate: evidencedCandidate("rev-3") });
    advanceToAwaitingApproval(tx2);
    expect(tx2.fire("commit_change", { approvalRefs: ["appr-2"] }).ok).toBe(true);
    expect(ledger.activeRevision).toBe("rev-3");
    // rollback creates a NEW revision referencing the restored prior state
    const rb = createTransaction({ id: "tx-3", baseRevision: "rev-3", ledger, candidate: bareCandidate() });
    expect(rb.rollback("rev-1").ok).toBe(true);
    const restored = ledger.activeRevision!;
    expect(restored).not.toBe("rev-1");
    const rec = ledger.revision(restored)!;
    expect(rec.restoredFrom).toBe("rev-1");
    expect(rec.parent).toBe("rev-3");
    expect(rec.status).toBe("rolled_back");
    // all intervening revision history is preserved
    expect(ledger.revisions.map((x) => x.id)).toEqual(["rev-1", "rev-2", "rev-3", restored]);
    // a rollback target that is not a known revision is refused
    const rb2 = createTransaction({ id: "tx-4", baseRevision: "rev-3", ledger, candidate: bareCandidate() });
    expect(rb2.rollback("rev-404").reason).toBe(
      "rollback_is_new_revision does not hold: rollback target rev-404 is not a known revision",
    );
  });

  it("TypeScript conformance test: assert invariant inflight_operations_not_replayed at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: recovery never auto-replays non-idempotent effects without an explicit policy
    const ledger = baseLedgerWithInterruptedNonIdempotent();
    const tx = createTransaction({ ledger });
    advanceToAwaitingApproval(tx);
    expect(tx.fire("detect_revision_conflict").ok).toBe(true);
    // an explicit replay policy still refuses to re-run a non-idempotent effect
    const r = tx.fire("recover_interrupted_change", { recoveryPolicy: { kind: "replay" } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("inflight_operations_not_replayed does not hold: recovery policy replay would re-run non-idempotent effect eff-1");
    expect(tx.state).toBe("conflicted");
    expect(ledger.interruptedOperations.every((op) => op.status === "interrupted")).toBe(true);
    // mark-only recovery marks interrupted operations without replaying them
    const r2 = tx.fire("recover_interrupted_change");
    expect(r2.ok).toBe(true);
    expect(tx.state).toBe("recovered");
    expect(ledger.interruptedOperations.every((op) => op.status === "marked")).toBe(true);
    // an explicit replay policy may re-run idempotent effects
    const ledger2 = baseLedgerWithInterruptedIdempotent();
    const tx2 = createTransaction({ ledger: ledger2 });
    advanceToAwaitingApproval(tx2);
    expect(tx2.fire("detect_revision_conflict").ok).toBe(true);
    expect(tx2.fire("recover_interrupted_change", { recoveryPolicy: { kind: "replay" } }).ok).toBe(true);
    expect(tx2.state).toBe("recovered");
  });

  it("TypeScript conformance test: assert invariant migration_explicit at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: an unversioned or untested migration is not committed
    const untested = createTransaction({
      candidate: {
        id: "rev-2",
        evidence: { validation: ["v-1"], test: ["t-1"], safety: ["s-1"] },
        migration: { migrationId: "mig-1", migrationVersion: "", tested: false },
      },
    });
    advanceToAwaitingApproval(untested);
    const r = untested.fire("commit_change", { approvalRefs: ["appr-1"] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("migration_explicit does not hold: migration mig-1 is not versioned and tested");
    expect(untested.ledger.activeRevision).toBe(BASE); // prior state stays active
    // a versioned, tested migration commits atomically and is recorded on the revision
    const good = createTransaction({
      candidate: {
        id: "rev-2",
        evidence: { validation: ["v-1"], test: ["t-1"], safety: ["s-1"] },
        migration: { migrationId: "mig-1", migrationVersion: "mig-2026-01", tested: true },
      },
    });
    advanceToAwaitingApproval(good);
    expect(good.fire("commit_change", { approvalRefs: ["appr-1"] }).ok).toBe(true);
    expect(good.ledger.revision("rev-2")!.migration!.migrationVersion).toBe("mig-2026-01");
  });
});
