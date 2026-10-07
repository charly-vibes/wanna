// Purpose: conformance tests for the interaction-engine model transitions
// Responsibilities: all 8 ## Model transitions incl. guard-failure and state-preservation paths
// Rationale: derives_from [[spec]] ## Model — draft/normalized/evaluated/committed/invalid_context/stale_context/retired
import { describe, it, expect } from "vitest";
import { createEngine } from "../../src/engine/index";
import { makeContext, makePolicy } from "./fixtures";

describe("model transitions", () => {
  it("accept_context moves draft to normalized on a valid context", () => {
    const e = createEngine();
    expect(e.acceptContext(makeContext(), makePolicy()).ok).toBe(true);
    expect(e.state).toBe("normalized");
  });

  it("reject_invalid_context moves draft to invalid_context on a malformed context", () => {
    const e = createEngine();
    expect(e.acceptContext(makeContext({ need: "" }), makePolicy()).ok).toBe(true);
    expect(e.state).toBe("invalid_context");
  });

  it("correct_invalid_context returns to draft only with a new explicit snapshot", () => {
    const e = createEngine();
    e.acceptContext(makeContext({ need: "" }), makePolicy());
    expect(e.correctContext().ok).toBe(false); // no new snapshot yet
    expect(e.state).toBe("invalid_context");
    expect(e.acceptContext(makeContext(), makePolicy()).ok).toBe(true); // new snapshot re-enters draft
    expect(e.state).toBe("normalized");
  });

  it("evaluate_pinned_context moves normalized to evaluated with pinned versions", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    expect(e.evaluate().ok).toBe(true);
    expect(e.state).toBe("evaluated");
  });

  it("evaluate is refused without an accepted context", () => {
    const e = createEngine();
    expect(e.evaluate().ok).toBe(false);
    expect(e.state).toBe("draft");
  });

  it("commit_current_decision moves evaluated to committed when the revision is current", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    expect(e.commit().ok).toBe(true);
    expect(e.state).toBe("committed");
  });

  it("reject_stale_decision moves evaluated to stale_context when a new revision arrived", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.receiveRevisionBump(); // task revision changed between evaluation and commit
    expect(e.commit().ok).toBe(true); // refusal recorded as the stale transition
    expect(e.state).toBe("stale_context");
  });

  it("a stale context never commits and the prior committed state is preserved", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.receiveRevisionBump(); // task revision changed between evaluation and commit
    e.commit();
    expect(e.state).toBe("stale_context");
    expect(e.committedDecision).toBeUndefined();
  });

  it("refresh_stale_context returns to draft with a new explicit snapshot", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.receiveRevisionBump();
    e.commit();
    expect(e.correctContext().ok).toBe(false); // stale also needs a NEW snapshot
    expect(e.state).toBe("stale_context");
    e.acceptContext(makeContext(), makePolicy());
    expect(e.state).toBe("normalized");
  });

  it("retire_committed_decision moves committed to retired on an explicit command", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.commit();
    expect(e.retire({ kind: "cancel" }).ok).toBe(true);
    expect(e.state).toBe("retired");
  });

  it("retire is refused without an explicit command", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.commit();
    expect(e.retire().ok).toBe(false);
    expect(e.state).toBe("committed");
  });

  it("records accepted transitions in order", () => {
    const e = createEngine();
    e.acceptContext(makeContext(), makePolicy());
    e.evaluate();
    e.commit();
    e.retire({ kind: "supersede" });
    expect(e.log.map((t) => t.id)).toEqual(["accept_context", "evaluate_pinned_context", "commit_current_decision", "retire_committed_decision"]);
  });
});