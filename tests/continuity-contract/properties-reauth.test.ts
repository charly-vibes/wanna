// Purpose: property test for the reauthentication_preserves_task constraint
// Responsibilities: reauth_does_not_authorize as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/reauth-does-not-authorize.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import {
  authorizesAction,
  reauthenticationRestoresTask,
} from "../../src/continuity-contract/invariants";
import { validScope, validTask, validatedDraft } from "./fixtures";

describe("continuity-contract properties", () => {
  it("Security test: successful reauthentication cannot satisfy a separate action authorization guard", () => {
    // successful reauthentication restores the same task context and validated draft
    const task = validTask();
    const session = reauthenticationRestoresTask(task, { authenticated: true, method: "password" });
    expect(session.authenticated).toBe(true);
    expect(session.taskContext.priorGoal).toBe(task.goal);
    expect(session.taskContext.lastConfirmedState).toBe(task.lastConfirmedState);
    expect(session.taskContext.completed).toEqual(task.completed);
    expect(session.taskContext.pending).toEqual(task.pending);
    expect(session.validatedDraft).toEqual(task.validatedDraft);
    // authentication success grants no action authorizations
    expect(session.actionAuthorizations).toEqual([]);
    const denied = authorizesAction(session, "act-1");
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe(
      "action act-1 is not authorized — authentication success is not action authorization",
    );
    // a separate action authorization guard — never authentication — is the only grant path
    const granted = authorizesAction({ ...session, actionAuthorizations: ["act-1"] }, "act-1");
    expect(granted.ok).toBe(true);
    // reauthentication after suspension restores the same task context and draft
    const m = createContinuityMachine(validTask());
    m.fire("checkpoint_active_task", validScope());
    expect(m.fire("suspend_checkpoint", {}).ok).toBe(true);
    const restored = reauthenticationRestoresTask(m.task, { authenticated: true, method: "sso" });
    expect(restored.validatedDraft).toEqual(validatedDraft());
    expect(restored.taskContext.priorGoal).toBe(validTask().goal);
  });
});
