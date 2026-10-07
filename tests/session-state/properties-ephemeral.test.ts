// Purpose: property test for presentation state non-authoritativeness
// Responsibilities: ephemera may be restored but cannot determine task completion or authority
// Rationale: host focus, scroll, cursor, and panels are presentation state; authority lives in the durable record only
import { describe, it, expect } from "vitest";
import { freshSession, pendingInteraction } from "./fixtures";

describe("session-state ephemeral properties", () => {
  it("host focus, scroll, cursor, open panels, and similar ephemera may be restored but cannot determine task completion or authority", () => {
    const m = freshSession();
    // ephemera are restorable
    m.setEphemeral("focus", "panel-2");
    m.setEphemeral("scroll", 1200);
    m.setEphemeral("cursor", { line: 3, column: 14 });
    m.setEphemeral("openPanels", ["outline", "log"]);
    expect(m.ephemeral).toEqual({
      focus: "panel-2",
      scroll: 1200,
      cursor: { line: 3, column: 14 },
      openPanels: ["outline", "log"],
    });
    // but they cannot determine task completion: completion comes from the durable record only
    expect(m.continuity.completed).toEqual([]);
    m.setEphemeral("completed", ["int-1"]);
    expect(m.continuity.completed).toEqual([]);
    expect(m.session.completed).toEqual([]);
    expect(m.completeInteraction("int-1")).toEqual({
      ok: false,
      reason: "interaction int-1 is not pending",
    });
    // only the durable operation completes a task
    m.recordPending(pendingInteraction({ interactionId: "int-1" }));
    expect(m.completeInteraction("int-1").ok).toBe(true);
    expect(m.continuity.completed).toEqual(["int-1"]);
    // and they cannot grant authority: closing requires the explicit durable action
    m.setEphemeral("closeReason", "completed");
    expect(m.state).toBe("open");
    expect(m.fire("close_session", {})).toEqual({
      ok: false,
      reason: "session_close_explicit does not hold: closing requires an explicit reason (completed, cancelled, or admin_recovery), got undefined",
    });
    expect(m.fire("close_session", { reason: "completed" }).ok).toBe(true);
    // once closed, no ephemera can reopen the session
    m.setEphemeral("focus", "restored");
    expect(m.ephemeral.focus).toBe("restored");
    expect(m.state).toBe("closed");
    expect(m.recordPending(pendingInteraction({ interactionId: "int-9" })).ok).toBe(false);
  });
});
