// Purpose: property test for the resume_reorients_user constraint (resume_explains_delta)
// Responsibilities: resume_explains_delta as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/resume-explains-delta.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import { resumeReorientsUser, RESUME_FIELDS } from "../../src/continuity-contract/invariants";
import type { ResumeContext } from "../../src/continuity-contract/types";
import { validResumeContext, validScope, validTask } from "./fixtures";

describe("continuity-contract properties", () => {
  it("UX contract test: resumed task exposes completed/pending/changed/unresolved/next-action fields", () => {
    // full run to resumed through the changed-context path
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    m.fire("suspend_checkpoint", {});
    m.fire(
      "begin_reorientation",
      validResumeContext({
        changedSinceSuspension: ["reviewer added a section"],
        unresolvedFailures: ["send-summary-email failed"],
      }),
    );
    m.fire("reconcile_changed_context", { currentRevision: "task-9" });
    expect(m.fire("resume_reconciled_context", undefined).ok).toBe(true);
    // the resumed task exposes all seven reorientation fields
    const context = m.resumeContext as Required<ResumeContext>;
    expect(context.priorGoal).toBe(validTask().goal);
    expect(context.lastConfirmedState).toBe(validTask().lastConfirmedState);
    expect(context.completed).toEqual(["collect timeline facts", "draft summary"]);
    expect(context.pending).toEqual(["review summary", "send summary"]);
    expect(context.changedSinceSuspension).toEqual(["reviewer added a section"]);
    expect(context.unresolvedFailures).toEqual(["send-summary-email failed"]);
    expect(context.nextAction).toBe("review the summary draft");
    // the guard validates the whole context directly
    expect(resumeReorientsUser(validResumeContext()).ok).toBe(true);
    // omitting any one reorientation field is named precisely
    for (const { field, label } of RESUME_FIELDS) {
      const partial = validResumeContext({ [field]: undefined } as Partial<ResumeContext>);
      const r = resumeReorientsUser(partial);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(
        `guard resume_reorients_user does not hold: resume context does not expose ${label}`,
      );
    }
    // no resume context at all is also named precisely
    const none = resumeReorientsUser(undefined as never);
    expect(none.ok).toBe(false);
    expect(none.reason).toBe("guard resume_reorients_user does not hold: no resume context provided");
  });
});
