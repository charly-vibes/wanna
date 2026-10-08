// Purpose: property test for the handoff_preserves_ownership constraint
// Responsibilities: p_handoff_preserves_ownership as a vitest test; name matches the contract TOML description verbatim
// Rationale: ah check binds .espectacular/continuity-contract/p-handoff-preserves-ownership.toml via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createContinuityMachine } from "../../src/continuity-contract/machine";
import {
  handoffPreservesOwnership,
  HANDOFF_CATEGORIES,
} from "../../src/continuity-contract/invariants";
import type { HandoffRecord } from "../../src/continuity-contract/types";
import { validHandoffRecord, validTask } from "./fixtures";

describe("continuity-contract properties", () => {
  it(
    "human-to-human or human-to-agent handoff records current owner, transferred authority scope, " +
      "pending decisions, unresolved risks, and evidence references",
    () => {
      // human-to-agent handoff records every ownership category and the machine retains it
      expect(handoffPreservesOwnership(validHandoffRecord()).ok).toBe(true);
      const toAgent = createContinuityMachine(validTask());
      expect(toAgent.fire("handoff_task", validHandoffRecord({ newOwner: "agent:claude" })).ok).toBe(true);
      expect(toAgent.state).toBe("handed_off");
      expect(toAgent.handoff?.newOwner).toBe("agent:claude");
      // human-to-human handoff works the same way
      const toHuman = createContinuityMachine(validTask());
      expect(toHuman.fire("handoff_task", validHandoffRecord({ newOwner: "human:desk" })).ok).toBe(true);
      // abandonment also preserves ownership — nothing is silently dropped
      const abandoned = createContinuityMachine(validTask());
      expect(abandoned.fire("abandon_task", validHandoffRecord({ newOwner: "nobody" })).ok).toBe(true);
      expect(abandoned.state).toBe("abandoned");
      expect(abandoned.handoff?.currentOwner).toBe("human:desk");
      const retained = abandoned.handoff as Record<string, unknown>;
      for (const { field } of HANDOFF_CATEGORIES) {
        expect(retained[field]).toBeDefined();
      }
      // omitting any one category is named precisely — the handoff is not silently partial
      for (const { field, label } of HANDOFF_CATEGORIES) {
        const partial = validHandoffRecord({ [field]: undefined } as Partial<HandoffRecord>);
        const r = handoffPreservesOwnership(partial);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(
          `guard handoff_preserves_ownership does not hold: handoff record does not preserve ${label}`,
        );
      }
      // no record at all is also named precisely
      const none = handoffPreservesOwnership(undefined as never);
      expect(none.ok).toBe(false);
      expect(none.reason).toBe(
        "guard handoff_preserves_ownership does not hold: no handoff record provided",
      );
    },
  );
});
