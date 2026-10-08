// Purpose: property tests for the session-state invariants
// Responsibilities: each corpus property of session-state as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/session-state/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createSession } from "../../src/session-state/machine";
import {
  SCHEMA_VERSION,
} from "../../src/session-state/types";
import { ENV, freshSession, pendingInteraction, serializedSession, tamperSerialized } from "./fixtures";

describe("session-state properties", () => {
  it("TypeScript conformance test: assert invariant session_identity_stable at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    expect(m.session.sessionId).toBe("session-1");
    expect(m.session.revision).toBe(1);
    // the id stays stable across every kind of operation
    m.recordPending(pendingInteraction());
    expect(m.session.sessionId).toBe("session-1");
    const afterRecord = m.session.revision;
    m.recordPending(pendingInteraction({ interactionId: "int-2" }));
    expect(m.session.sessionId).toBe("session-1");
    expect(m.session.revision).toBe(afterRecord + 1);
    m.completeInteraction("int-1");
    expect(m.session.sessionId).toBe("session-1");
    const afterComplete = m.session.revision;
    m.markChanged("int-2");
    expect(m.session.revision).toBe(afterComplete + 1);
    // the revision only ever moves forward
    m.recordPending(pendingInteraction({ interactionId: "int-3" }));
    const beforeConflict = m.session.revision;
    m.fire("detect_conflict", { baseRevision: 1 });
    expect(m.session.revision).toBe(beforeConflict + 1);
    // edge: an empty session id is rejected at the trust boundary
    expect(() => createSession("", ENV)).toThrow("session identity requires a non-empty session id");
    // edge: a concurrent replacement must keep the stable session id
    const staleId = m.writeWithPrecondition(m.session.revision, (s) => ({
      ...s,
      sessionId: "session-2",
    }));
    expect(staleId).toEqual({
      ok: false,
      reason: "concurrent update rejected: replacement must keep the stable session id",
    });
    expect(m.session.sessionId).toBe("session-1");
  });

  it("TypeScript conformance test: assert invariant pending_interactions_indexed at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    m.recordPending(
      pendingInteraction({ interactionId: "int-2", taskRevision: "task-8", contractRevision: "contract-2" }),
    );
    // indexed by stable interaction id, identifying task and contract revision
    expect(m.session.pending["int-1"]).toEqual(pendingInteraction());
    expect(m.session.pending["int-2"]).toEqual({
      interactionId: "int-2",
      taskRevision: "task-8",
      contractRevision: "contract-2",
    });
    // edge: duplicate index entry is rejected
    expect(m.recordPending(pendingInteraction())).toEqual({
      ok: false,
      reason: "pending interaction int-1 already exists",
    });
    // edge: entries must identify their task and contract revision
    expect(m.recordPending(pendingInteraction({ interactionId: "int-3", taskRevision: "" }))).toEqual({
      ok: false,
      reason: "pending interaction int-3 requires its task revision",
    });
    expect(m.recordPending(pendingInteraction({ interactionId: "int-3", contractRevision: "" }))).toEqual({
      ok: false,
      reason: "pending interaction int-3 requires its contract revision",
    });
    expect(m.recordPending(pendingInteraction({ interactionId: "" }))).toEqual({
      ok: false,
      reason: "pending interaction requires a stable interaction id",
    });
    // completion moves the entry from pending to completed, keeping the index exact
    m.completeInteraction("int-1");
    expect(m.session.pending["int-1"]).toBeUndefined();
    expect(m.session.completed).toEqual(["int-1"]);
  });

  it("TypeScript conformance test: assert invariant session_serializable at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction({ interactionId: "int-1" }));
    const parsed = JSON.parse(m.serialize()) as Record<string, unknown>;
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.policyVersion).toBe(ENV.policyVersion);
    expect(parsed.sessionId).toBe("session-1");
    expect(parsed.pending).toEqual(m.session.pending);
    // round trip: serialize -> parse -> serialize is stable
    const roundTrip = JSON.stringify(JSON.parse(m.serialize()));
    expect(JSON.parse(roundTrip)).toEqual(parsed);
    // edge: durable state may not smuggle functions, undefined, or host handles
    const r1 = m.fire("suspend_session", { snapshot: { deep: { fn: () => "x" } } });
    expect(r1).toEqual({
      ok: false,
      reason: "session_serializable does not hold: durable state contains a function or closure at root.snapshot.deep.fn",
    });
    const r2 = m.fire("suspend_session", { snapshot: { note: undefined } });
    expect(r2).toEqual({
      ok: false,
      reason: "session_serializable does not hold: durable state contains undefined at root.snapshot.note",
    });
    const r3 = m.fire("suspend_session", { snapshot: { handle: "stdio-1" } });
    expect(r3).toEqual({
      ok: false,
      reason: "session_serializable does not hold: durable state contains host/presentation state at root.snapshot.handle",
    });
    // plain data passes and the machine suspends
    expect(m.fire("suspend_session", { snapshot: { note: "ok" } }).ok).toBe(true);
  });

  it("TypeScript conformance test: assert invariant resume_validates_revisions at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    m.fire("suspend_session", {});
    const raw = serializedSession();
    // not JSON at all
    expect(m.fire("begin_recovery", { serialized: "{not json" })).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: serialized session is not valid JSON",
    });
    // schema version drift is rejected
    expect(
      m.fire("begin_recovery", {
        serialized: tamperSerialized(raw, (r) => {
          r.schemaVersion = "session-state-0";
        }),
      }),
    ).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: schema version mismatch (recorded session-state-0, expected session-state-1)",
    });
    // policy version drift is rejected
    expect(
      m.fire("begin_recovery", {
        serialized: tamperSerialized(raw, (r) => {
          r.policyVersion = "policy-other";
        }),
      }),
    ).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: policy version mismatch (recorded policy-other, expected policy-2026.10)",
    });
    // incompatible interaction contract revision is rejected
    expect(
      m.fire("begin_recovery", {
        serialized: tamperSerialized(raw, (r) => {
          const pending = r.pending as Record<string, { contractRevision: string }>;
          pending["int-1"]!.contractRevision = "contract-9";
        }),
      }),
    ).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: interaction int-1 contract revision contract-9 is not compatible",
    });
    // missing task revision is rejected
    expect(
      m.fire("begin_recovery", {
        serialized: tamperSerialized(raw, (r) => {
          const pending = r.pending as Record<string, { taskRevision: string }>;
          pending["int-1"]!.taskRevision = "";
        }),
      }),
    ).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: interaction int-1 is missing its task revision",
    });
    // broken recorded identity is rejected
    for (const mutate of [
      (r: Record<string, unknown>) => {
        r.sessionId = "";
      },
      (r: Record<string, unknown>) => {
        r.revision = 0;
      },
      (r: Record<string, unknown>) => {
        r.revision = 1.5;
      },
    ]) {
      expect(m.fire("begin_recovery", { serialized: tamperSerialized(raw, mutate) })).toEqual({
        ok: false,
        reason: "resume_validates_revisions does not hold: recorded session identity is invalid",
      });
    }
    // a valid record passes
    m.recordPending(pendingInteraction());
    m.fire("suspend_session", {});
    expect(m.fire("begin_recovery", { serialized: serializedSession() }).ok).toBe(true);
  });

  it("TypeScript conformance test: assert invariant presentation_ephemeral_separate at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    const revisionBefore = m.session.revision;
    m.setEphemeral("focus", "panel-2");
    m.setEphemeral("scroll", 42);
    // ephemera live outside the durable session record
    expect(m.ephemeral).toEqual({ focus: "panel-2", scroll: 42 });
    expect(m.session.revision).toBe(revisionBefore);
    const parsed = JSON.parse(m.serialize()) as Record<string, unknown>;
    expect(parsed.focus).toBeUndefined();
    expect(parsed.scroll).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain("panel-2");
    // ephemera do not block suspension of the durable record
    expect(m.fire("suspend_session", {}).ok).toBe(true);
    expect(m.ephemeral).toEqual({ focus: "panel-2", scroll: 42 });
  });

  it("TypeScript conformance test: assert invariant concurrent_updates_detected at its trust boundary and under its stated edge cases.", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    m.recordPending(pendingInteraction({ interactionId: "int-2" }));
    // a writer holding the current revision applies through the precondition
    const current = m.session.revision;
    const ok = m.writeWithPrecondition(current, (s) => ({ ...s, nextAttention: "int-2" }));
    expect(ok).toEqual({ ok: true });
    expect(m.session.nextAttention).toBe("int-2");
    expect(m.session.revision).toBe(current + 1);
    // a stale writer is detected, not applied last-write-wins
    const stale = m.writeWithPrecondition(1, (s) => ({ ...s, nextAttention: "hijacked" }));
    expect(stale).toEqual({
      ok: false,
      reason: "concurrent update detected: expected revision 1 but session is at " + (current + 1),
    });
    expect(m.session.nextAttention).toBe("int-2");
    // the machine records the conflict state when a stale write is observed
    const r = m.fire("detect_conflict", { baseRevision: 1 });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("conflicted");
  });

  it("TypeScript conformance test: assert invariant session_close_explicit at its trust boundary and under its stated edge cases.", () => {
    for (const reason of ["completed", "cancelled", "admin_recovery"] as const) {
      const m = freshSession();
      m.recordPending(pendingInteraction());
      expect(m.fire("close_session", { reason }).ok).toBe(true);
      expect(m.state).toBe("closed");
      expect(m.session.closeReason).toBe(reason);
      const parsed = JSON.parse(m.serialize()) as Record<string, unknown>;
      expect(parsed.closeReason).toBe(reason);
    }
    // edge: closing without an explicit reason is refused
    const m = freshSession();
    expect(m.fire("close_session", {})).toEqual({
      ok: false,
      reason: "session_close_explicit does not hold: closing requires an explicit reason (completed, cancelled, or admin_recovery), got undefined",
    });
    // edge: a closed session accepts no further updates or transitions
    const closed = freshSession();
    closed.fire("close_session", { reason: "cancelled" });
    expect(closed.recordPending(pendingInteraction())).toEqual({
      ok: false,
      reason: "session is closed and no longer accepts updates",
    });
    expect(closed.fire("suspend_session", {})).toEqual({
      ok: false,
      reason: "transition suspend_session cannot fire from state closed",
    });
  });
});
