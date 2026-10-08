// Purpose: transition tests for the continuity-contract model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons
import { describe, it, expect } from "vitest";
import {
  createContinuityMachine,
  CONTINUITY_TRANSITIONS,
} from "../../src/continuity-contract/machine";
import type { TransitionPayloadMap } from "../../src/continuity-contract/types";
import {
  validHandoffRecord,
  validResumeContext,
  validScope,
  validTask,
} from "./fixtures";

describe("continuity-contract transitions", () => {
  it("checkpoint_active_task moves active → checkpointed when checkpoint_scope_explicit holds", () => {
    const m = createContinuityMachine(validTask());
    const r = m.fire("checkpoint_active_task", validScope());
    expect(r.ok).toBe(true);
    expect(m.state).toBe("checkpointed");
    expect(m.checkpoint).toEqual({
      checkpointId: "checkpoint-task-7",
      taskRevision: "task-7",
      scope: validScope(),
    });
  });

  it("checkpoint_active_task refuses to fire when the scope does not identify evidence", () => {
    const m = createContinuityMachine(validTask());
    const r = m.fire("checkpoint_active_task", validScope({ evidenceRefs: undefined }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard checkpoint_scope_explicit does not hold: checkpoint scope does not identify evidence",
    );
    expect(m.state).toBe("active");
  });

  it("suspend_checkpoint moves checkpointed → suspended with the validated draft preserved", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    const r = m.fire("suspend_checkpoint", {});
    expect(r.ok).toBe(true);
    expect(m.state).toBe("suspended");
    expect(m.disposalReason).toBe(null);
    expect(m.task.validatedDraft?.validated).toBe(true);
  });

  it("suspend_checkpoint refuses to fire when disposal policy is not explicit", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    const r = m.fire("suspend_checkpoint", { requiresDisposal: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard interrupted_input_preserved does not hold: policy requires disposal of validated input but the loss is not explicit (missing disposal reason)",
    );
    expect(m.state).toBe("checkpointed");
  });

  it("begin_reorientation moves suspended → reorienting when resume_reorients_user holds", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    const r = m.fire("begin_reorientation", validResumeContext());
    expect(r.ok).toBe(true);
    expect(m.state).toBe("reorienting");
    expect(m.resumeContext).toEqual(validResumeContext());
  });

  it("begin_reorientation refuses to fire when the resume context omits the required next action", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    const r = m.fire("begin_reorientation", validResumeContext({ nextAction: undefined }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard resume_reorients_user does not hold: resume context does not expose required next action",
    );
    expect(m.state).toBe("suspended");
  });

  it("reconcile_changed_context moves reorienting → reconciling when the authoritative revision changed, rejecting stale pending actions", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire("begin_reorientation", validResumeContext());
    const r = m.fire("reconcile_changed_context", { currentRevision: "task-9" });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("reconciling");
    expect(m.reconciliation).toEqual({
      checkpointRevision: "task-7",
      currentRevision: "task-9",
      dispositions: { "act-1": "rejected" },
    });
  });

  it("reconcile_changed_context refuses to fire when the authoritative revision is unchanged", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire("begin_reorientation", validResumeContext());
    const r = m.fire("reconcile_changed_context", { currentRevision: "task-7" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard stale_context_reconciled does not hold: authoritative revision task-7 is unchanged since the checkpoint — resume via resume_unchanged_context",
    );
    expect(m.state).toBe("reorienting");
  });

  it("resume_unchanged_context moves reorienting → resumed when the resume context was exposed", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire("begin_reorientation", validResumeContext());
    const r = m.fire("resume_unchanged_context", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("resumed");
  });

  it("resume_reconciled_context moves reconciling → resumed when every pending action has a disposition", () => {
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire("begin_reorientation", validResumeContext());
    m.fire("reconcile_changed_context", { currentRevision: "task-9" });
    const r = m.fire("resume_reconciled_context", undefined);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("resumed");
  });

  it("handoff_task moves active → handed_off when handoff_preserves_ownership holds", () => {
    const m = createContinuityMachine(validTask());
    const r = m.fire("handoff_task", validHandoffRecord({ newOwner: "agent:claude" }));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("handed_off");
    expect(m.handoff).toEqual(validHandoffRecord({ newOwner: "agent:claude" }));
  });

  it("handoff_task refuses to fire when the record omits the current owner", () => {
    const m = createContinuityMachine(validTask());
    const r = m.fire("handoff_task", validHandoffRecord({ currentOwner: undefined }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard handoff_preserves_ownership does not hold: handoff record does not preserve current owner",
    );
    expect(m.state).toBe("active");
  });

  it("abandon_task moves active → abandoned when the abandonment record preserves ownership", () => {
    const m = createContinuityMachine(validTask());
    const r = m.fire("abandon_task", validHandoffRecord({ newOwner: "nobody" }));
    expect(r.ok).toBe(true);
    expect(m.state).toBe("abandoned");
    expect(m.handoff).toEqual(validHandoffRecord({ newOwner: "nobody" }));
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const payloads: TransitionPayloadMap = {
      checkpoint_active_task: validScope(),
      suspend_checkpoint: {},
      begin_reorientation: validResumeContext(),
      reconcile_changed_context: { currentRevision: "task-9" },
      resume_unchanged_context: undefined,
      resume_reconciled_context: undefined,
      handoff_task: validHandoffRecord(),
      abandon_task: validHandoffRecord(),
    };
    const m = createContinuityMachine(validTask());
    for (const row of CONTINUITY_TRANSITIONS) {
      if (row.from === "active") continue;
      const r = m.fire(row.id, payloads[row.id]);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`transition ${row.id} cannot fire from state active`);
    }
    expect(m.state).toBe("active");
    // a fired transition cannot refire from its target state
    expect(m.fire("checkpoint_active_task", payloads.checkpoint_active_task).ok).toBe(true);
    const again = m.fire("checkpoint_active_task", payloads.checkpoint_active_task);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe(
      "transition checkpoint_active_task cannot fire from state checkpointed",
    );
  });
});
