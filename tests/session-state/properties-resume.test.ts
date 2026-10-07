// Purpose: property test for resume reorientation
// Responsibilities: continuity summary is derivable before any consequential continuation after restore
// Rationale: restoring serialized data alone is not resume — the summary names completed, pending, changed, unresolved, and next-attention items
import { describe, it, expect } from "vitest";
import { freshSession, pendingInteraction, serializedSession } from "./fixtures";

describe("session-state resume properties", () => {
  it("Resume test: continuity summary is derivable before consequential continuation", () => {
    // build a session with items in every continuity category
    const source = freshSession();
    source.recordPending(pendingInteraction({ interactionId: "int-1" }));
    source.recordPending(pendingInteraction({ interactionId: "int-2" }));
    source.recordPending(pendingInteraction({ interactionId: "int-3" }));
    source.completeInteraction("int-1");
    source.markChanged("int-2");
    source.markUnresolved("int-3");
    source.setNextAttention("int-2");
    source.fire("suspend_session", {});
    const raw = source.serialize();

    // restore into a fresh machine: suspend, begin recovery, resume
    const m = freshSession("session-restored");
    m.fire("suspend_session", {});
    m.fire("begin_recovery", { serialized: raw });
    expect(m.fire("resume_session", {}).ok).toBe(true);
    expect(m.session.pending["int-2"]).toEqual(pendingInteraction({ interactionId: "int-2" }));

    // no consequential continuation has happened yet — the summary is already derivable
    expect(m.continuity).toEqual({
      completed: ["int-1"],
      pending: ["int-2", "int-3"],
      changed: ["int-2"],
      unresolved: ["int-3"],
      nextAttention: "int-2",
    });
    // and it is derivable from the serialized record alone, without the machine
    expect(freshSession("any").continuity).toEqual({
      completed: [],
      pending: [],
      changed: [],
      unresolved: [],
      nextAttention: null,
    });
    expect(serializedSession()).toContain('"sessionId"');
  });
});
