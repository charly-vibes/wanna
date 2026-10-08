// Purpose: property test for the stale_context_reconciled constraint
// Responsibilities: stale_pending_action_not_silently_committed as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/stale-pending-action-not-silently-committed.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import {
  pendingActionCommit,
  stalePendingActionsReconciled,
} from "../../src/continuity-contract/invariants";
import { validHandoffRecord, validResumeContext, validScope, validTask } from "./fixtures";

describe("continuity-contract properties", () => {
  it("Concurrency test: changed authoritative revision forces reconciliation before pending action can commit", () => {
    const task = validTask({
      pendingActions: [
        { actionId: "act-1", preparedAgainstRevision: "task-7" },
        { actionId: "act-2", preparedAgainstRevision: "task-9" },
      ],
    });
    // commit before any reconciliation is blocked, naming the blocker
    expect(pendingActionCommit(task.pendingActions[0]!, "task-9", null)).toEqual({
      ok: false,
      reason:
        "guard stale_context_reconciled does not hold: pending action act-1 cannot commit before revision task-9 is reconciled",
    });
    // the machine reconciles the revision change: stale actions are rejected, current ones revalidated
    const m = createContinuityMachine(task);
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire("begin_reorientation", validResumeContext());
    m.fire("reconcile_changed_context", { currentRevision: "task-9" });
    expect(m.reconciliation).toEqual({
      checkpointRevision: "task-7",
      currentRevision: "task-9",
      dispositions: { "act-1": "rejected", "act-2": "revalidated" },
    });
    // the stale action cannot silently commit after reconciliation either
    expect(pendingActionCommit(task.pendingActions[0]!, "task-9", m.reconciliation)).toEqual({
      ok: false,
      reason:
        "guard stale_context_reconciled does not hold: pending action act-1 was rejected by reconciliation as stale and cannot silently commit",
    });
    // the action prepared against the authoritative revision commits after reconciliation
    expect(pendingActionCommit(task.pendingActions[1]!, "task-9", m.reconciliation)).toEqual({
      ok: true,
    });
    // an action missing from the reconciliation record is not silently committed
    expect(
      pendingActionCommit({ actionId: "act-3", preparedAgainstRevision: "task-9" }, "task-9", m.reconciliation),
    ).toEqual({
      ok: false,
      reason: "guard stale_context_reconciled does not hold: pending action act-3 has no reconciliation disposition",
    });
    // the resume_reconciled_context guard refuses undisposed pending actions
    expect(
      stalePendingActionsReconciled([{ actionId: "act-4", preparedAgainstRevision: "task-9" }], {
        checkpointRevision: "task-7",
        currentRevision: "task-9",
        dispositions: {},
      }),
    ).toEqual({
      ok: false,
      reason: "guard stale_context_reconciled does not hold: pending action act-4 has no reconciliation disposition",
    });
    // sanity: the same machine path reaches handed_off so ownership flows stay coherent
    expect(m.fire("handoff_task", validHandoffRecord()).ok).toBe(false);
  });
});
