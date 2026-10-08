// Purpose: transition tests for the session-state model
// Responsibilities: every [[openspec/specs/session-state/spec.md]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror the spec row for row; guards must fail with precise reasons
import { describe, it, expect } from "vitest";
import { freshSession, pendingInteraction, serializedSession, tamperSerialized } from "./fixtures";

describe("session-state transitions", () => {
  it("suspend_session moves open → suspended when the session_serializable guard holds", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    const r = m.fire("suspend_session", { snapshot: { note: "plain data" } });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("suspended");
    expect(m.history).toContain("suspend_session open->suspended");
  });

  it("suspend_session refuses when the snapshot contains host/presentation state", () => {
    const m = freshSession();
    const r = m.fire("suspend_session", { snapshot: { uiTree: { widget: "modal" } } });
    expect(r).toEqual({
      ok: false,
      reason: "session_serializable does not hold: durable state contains host/presentation state at root.snapshot.uiTree",
    });
    expect(m.state).toBe("open");
  });

  it("suspend_session refuses when the snapshot contains a function or closure", () => {
    const m = freshSession();
    const r = m.fire("suspend_session", { snapshot: { callback: () => "x" } });
    expect(r).toEqual({
      ok: false,
      reason: "session_serializable does not hold: durable state contains a function or closure at root.snapshot.callback",
    });
    expect(m.state).toBe("open");
  });

  it("begin_recovery moves suspended → recovering when resume_validates_revisions holds", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    m.fire("suspend_session", {});
    const r = m.fire("begin_recovery", { serialized: m.serialize() });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("recovering");
    expect(m.history).toContain("begin_recovery suspended->recovering");
  });

  it("begin_recovery refuses when the recorded policy version differs", () => {
    const m = freshSession();
    m.fire("suspend_session", {});
    const tampered = tamperSerialized(m.serialize(), (r) => {
      r.policyVersion = "policy-other";
    });
    const r = m.fire("begin_recovery", { serialized: tampered });
    expect(r).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: policy version mismatch (recorded policy-other, expected policy-2026.10)",
    });
    expect(m.state).toBe("suspended");
  });

  it("resume_session moves recovering → open when resume_validates_revisions holds", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    m.fire("suspend_session", {});
    m.fire("begin_recovery", { serialized: serializedSession() });
    const r = m.fire("resume_session", {});
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("open");
    expect(m.session.pending["int-1"]).toEqual(pendingInteraction());
    expect(m.history).toContain("resume_session recovering->open");
  });

  it("resume_session refuses when an interaction contract revision is not compatible", () => {
    const m = freshSession();
    m.fire("suspend_session", {});
    m.fire("begin_recovery", { serialized: serializedSession() });
    const tampered = tamperSerialized(serializedSession(), (r) => {
      const pending = r.pending as Record<string, { contractRevision: string }>;
      pending["int-1"]!.contractRevision = "contract-9";
    });
    const r = m.fire("resume_session", { serialized: tampered });
    expect(r).toEqual({
      ok: false,
      reason: "resume_validates_revisions does not hold: interaction int-1 contract revision contract-9 is not compatible",
    });
    expect(m.state).toBe("recovering");
  });

  it("detect_conflict moves open → conflicted when a stale write is observed", () => {
    const m = freshSession();
    m.recordPending(pendingInteraction());
    // session is at revision 2; a writer holding revision 1 is stale
    const r = m.fire("detect_conflict", { baseRevision: 1 });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("conflicted");
    expect(m.history).toContain("detect_conflict open->conflicted");
  });

  it("detect_conflict refuses when the revision precondition is satisfied", () => {
    const m = freshSession();
    const r = m.fire("detect_conflict", { baseRevision: 1 });
    expect(r).toEqual({
      ok: false,
      reason: "concurrent_updates_detected does not hold: revision precondition satisfied (base 1 equals current 1) — no concurrent update to resolve",
    });
    expect(m.state).toBe("open");
  });

  it("close_session moves open → closed when an explicit reason is given", () => {
    const m = freshSession();
    const r = m.fire("close_session", { reason: "completed" });
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("closed");
    expect(m.session.closeReason).toBe("completed");
    expect(m.history).toContain("close_session open->closed");
  });

  it("close_session refuses without an explicit reason", () => {
    const m = freshSession();
    const r = m.fire("close_session", {});
    expect(r).toEqual({
      ok: false,
      reason: "session_close_explicit does not hold: closing requires an explicit reason (completed, cancelled, or admin_recovery), got undefined",
    });
    expect(m.state).toBe("open");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = freshSession();
    expect(m.fire("begin_recovery", { serialized: serializedSession() })).toEqual({
      ok: false,
      reason: "transition begin_recovery cannot fire from state open",
    });
    expect(m.fire("resume_session", {})).toEqual({
      ok: false,
      reason: "transition resume_session cannot fire from state open",
    });
    expect(m.fire("close_session", { reason: "completed" })).toEqual({ ok: true });
    expect(m.fire("suspend_session", {})).toEqual({
      ok: false,
      reason: "transition suspend_session cannot fire from state closed",
    });
    expect(m.fire("detect_conflict", { baseRevision: 0 })).toEqual({
      ok: false,
      reason: "transition detect_conflict cannot fire from state closed",
    });
  });
});
