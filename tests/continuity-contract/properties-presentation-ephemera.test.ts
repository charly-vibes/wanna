// Purpose: property test for the presentation_ephemera_not_authoritative constraint
// Responsibilities: p_presentation_ephemera_not_authoritative as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/p-presentation-ephemera-not-authoritative.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import {
  authoritativeProgress,
  ephemeraCannotMoveProgress,
  progressOmitsEphemera,
  EPHEMERA_FIELDS,
} from "../../src/continuity-contract/invariants";
import { validResumeContext, validScope, validTask } from "./fixtures";

function runToResumed(task: Parameters<typeof createContinuityMachine>[0]): string {
  const m = createContinuityMachine(task);
  m.fire("checkpoint_active_task", validScope());
  m.fire("suspend_checkpoint", {});
  m.fire("begin_reorientation", validResumeContext());
  m.fire("reconcile_changed_context", { currentRevision: "task-9" });
  m.fire("resume_reconciled_context", undefined);
  return m.state;
}

describe("continuity-contract properties", () => {
  it(
    "scroll position, cursor location, open panel, and host focus may aid restoration " +
      "but cannot determine authoritative task progress",
    () => {
      // authoritative task progress is derived from completed and pending work only
      const task = validTask();
      expect(authoritativeProgress(task)).toBe("completed=2 pending=2");
      // the checkpoint scope deliberately excludes the ephemera categories
      expect(validScope().excludedEphemera).toEqual([
        "scroll position",
        "cursor location",
        "open panel",
        "host focus",
      ]);
      // moving every ephemera field cannot move authoritative task progress
      const moved = validTask({
        ephemera: {
          scrollPosition: 9001,
          cursorLocation: "line 400",
          openPanel: "settings",
          hostFocus: "sidebar",
        },
      });
      expect(ephemeraCannotMoveProgress(task, moved).ok).toBe(true);
      // the progress derivation embeds no ephemera field name or value
      const progress = authoritativeProgress(task);
      for (const value of ["42", "line 12", "timeline", "editor"]) {
        expect(progress).not.toContain(value);
      }
      for (const field of EPHEMERA_FIELDS) {
        expect(progress).not.toContain(field);
      }
      expect(progressOmitsEphemera(task).ok).toBe(true);
      // adversarial: an ephemera value colliding with progress vocabulary is detected, not leaked
      const poisoned = validTask({ ephemera: { openPanel: "pending=2" } });
      expect(progressOmitsEphemera(poisoned)).toEqual({
        ok: false,
        reason:
          "guard presentation_ephemera_not_authoritative does not hold: authoritative task progress embeds presentation ephemera (openPanel)",
      });
      // the state-machine path is identical regardless of ephemera
      expect(runToResumed(task)).toBe("resumed");
      expect(runToResumed(moved)).toBe("resumed");
    },
  );
});
