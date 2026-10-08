// Purpose: property test for the checkpoint_scope_explicit constraint
// Responsibilities: p_checkpoint_scope_explicit as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/p-checkpoint-scope-explicit.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import { checkpointScopeExplicit, SCOPE_CATEGORIES } from "../../src/continuity-contract/invariants";
import type { CheckpointScope } from "../../src/continuity-contract/types";
import { validScope, validTask } from "./fixtures";

describe("continuity-contract properties", () => {
  it(
    "a continuity checkpoint identifies persisted domain/workflow data, uncommitted drafts, " +
      "active interactions, pending effects, evidence, and deliberately excluded ephemeral presentation state",
    () => {
      // a full scope validates and the machine records it as the checkpoint scope
      expect(checkpointScopeExplicit(validScope()).ok).toBe(true);
      const m = createContinuityMachine(validTask());
      expect(m.fire("checkpoint_active_task", validScope()).ok).toBe(true);
      expect(m.checkpoint?.taskRevision).toBe("task-7");
      const recorded = m.checkpoint?.scope as Record<string, unknown>;
      for (const { field } of SCOPE_CATEGORIES) {
        expect(Array.isArray(recorded[field])).toBe(true);
      }
      // omitting any one category is named precisely — the checkpoint is not silently partial
      for (const { field, label } of SCOPE_CATEGORIES) {
        const partial = validScope({ [field]: undefined } as Partial<CheckpointScope>);
        const r = checkpointScopeExplicit(partial);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard checkpoint_scope_explicit does not hold: checkpoint scope does not identify ${label}`,
        );
      }
      // no scope at all is also named precisely
      const none = checkpointScopeExplicit(undefined as never);
      expect(none.ok).toBe(false);
      expect(none.reason).toBe(
        "guard checkpoint_scope_explicit does not hold: no checkpoint scope provided",
      );
    },
  );
});
