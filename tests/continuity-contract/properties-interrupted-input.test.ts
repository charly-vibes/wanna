// Purpose: property test for the interrupted_input_preserved constraint
// Responsibilities: p_interrupted_input_preserved as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/p-interrupted-input-preserved.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import { interruptedInputPreserved } from "../../src/continuity-contract/invariants";
import { suspendPolicy, validScope, validTask, validatedDraft } from "./fixtures";

describe("continuity-contract properties", () => {
  it(
    "validated but uncommitted user input is preserved across recoverable interruption " +
      "unless security/privacy policy requires disposal, in which case the loss is explicit",
    () => {
      // with no disposal policy, suspension preserves the validated draft
      const preserved = createContinuityMachine(validTask());
      preserved.fire("checkpoint_active_task", validScope());
      expect(preserved.fire("suspend_checkpoint", {}).ok).toBe(true);
      expect(preserved.state).toBe("suspended");
      expect(preserved.disposalReason).toBe(null);
      expect(preserved.task.validatedDraft).toEqual(validatedDraft());
      // direct check agrees for a draft and an empty policy
      expect(interruptedInputPreserved(validatedDraft(), {}).ok).toBe(true);
      // nothing to preserve and nothing to dispose is not a failure
      expect(interruptedInputPreserved(undefined, {}).ok).toBe(true);

      // policy-mandated disposal is explicit: the machine records the loss reason
      const reason = "security policy: draft contained credentials";
      const disposed = createContinuityMachine(validTask());
      disposed.fire("checkpoint_active_task", validScope());
      expect(
        disposed.fire("suspend_checkpoint", suspendPolicy({ requiresDisposal: true, disposalReason: reason })).ok,
      ).toBe(true);
      expect(disposed.disposalReason).toBe(reason);

      // non-explicit disposal is refused — the input is not silently discarded
      const silent = createContinuityMachine(validTask());
      silent.fire("checkpoint_active_task", validScope());
      const r = silent.fire("suspend_checkpoint", suspendPolicy({ requiresDisposal: true }));
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(
        "guard interrupted_input_preserved does not hold: policy requires disposal of validated input but the loss is not explicit (missing disposal reason)",
      );
      expect(silent.state).toBe("checkpointed");
    },
  );
});
