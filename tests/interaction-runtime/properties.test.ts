// Purpose: property tests for the interaction runtime — state reduction, projection, lifecycle, and CAS properties
// Responsibilities: each corpus property of interaction-runtime as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-runtime/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  createInteractionRuntime,
  commitPreconditionsSatisfied,
  isLifecycle,
  projectRender,
  reduceEvent,
  replayLog,
} from "../../src/interaction-runtime/index";
import type {
  CommittedState,
  EventEnvelope,
  InteractionEventType,
} from "../../src/interaction-runtime/index";
import { CONTRACT_VERSION, EVENT_TYPES } from "../../src/interaction-runtime/index";
import { initialCommitted, rejectionOf, validEvent } from "./fixtures";

function afterResponse(state: CommittedState, event: EventEnvelope): CommittedState {
  const reduction = reduceEvent(state, event);
  if (!reduction.ok) throw new Error(`fixture reduction failed: ${reduction.reason}`);
  return reduction.next;
}

describe("interaction-runtime properties", () => {
  it("TypeScript test: missing, malformed, or mismatched event identity returns a rejection and leaves committed state unchanged", () => {
    const variants: [string, Partial<EventEnvelope>][] = [
      ["missing event id", { eventId: "" }],
      ["missing task id", { taskId: "" }],
      ["missing interaction id", { interactionId: "" }],
      ["unsupported event type: hover", { eventType: "hover" as InteractionEventType }],
      ["unsupported contract version: v0", { contractVersion: "v0" }],
      ["missing interaction revision", { interactionRevision: -1 }],
      ["missing task revision precondition", { taskRevision: 1.5 }],
      ["missing validated payload", { payload: undefined }],
    ];
    const rt = createInteractionRuntime(initialCommitted());
    for (const [detail, override] of variants) {
      const r = rt.submit(validEvent(override));
      expect(r.ok).toBe(false);
      expect(rejectionOf(r)).toBe(detail);
      expect(rt.state).toBe("malformed_event");
      expect(rt.committed).toEqual(initialCommitted());
    }
    // the corrected event recovers the runtime without any state damage
    expect(rt.submit(validEvent()).ok).toBe(true);
    expect(rt.committed.interactionRevision).toBe(3);
    // mismatched event identity is a precondition rejection — state still unchanged
    const mismatched = createInteractionRuntime(initialCommitted());
    const r = mismatched.submit(validEvent({ interactionId: "ix-other" }));
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe(
      "identity_mismatch: event task task-7/interaction ix-other does not match committed task task-7/interaction ix-1",
    );
    expect(mismatched.committed).toEqual(initialCommitted());
  });

  it("TypeScript test: stale revision and repeated event ID do not produce a second committed state change and expose distinct reason codes", () => {
    const base = initialCommitted({ interactionRevision: 3, appliedEventIds: ["ev-0", "ev-9"] });
    const rt = createInteractionRuntime(base);
    const staleInteraction = rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 2 }));
    expect(staleInteraction.ok).toBe(false);
    expect(rejectionOf(staleInteraction)).toContain("stale_interaction_revision: event expects 2, committed is 3");
    expect(rt.state).toBe("rejected_commit");
    // further probes pass through the refresh gate; each names its distinct code
    rt.receiveStateSnapshot(base);
    const staleTask = rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 3, taskRevision: 4 }));
    expect(staleTask.ok).toBe(false);
    expect(rejectionOf(staleTask)).toContain("stale_task_revision: event task-revision precondition 4 does not match committed 5");
    rt.receiveStateSnapshot(base);
    const duplicate = rt.submit(validEvent({ eventId: "ev-9", interactionRevision: 3 }));
    expect(duplicate.ok).toBe(false);
    expect(rejectionOf(duplicate)).toContain("duplicate_event_id: event ev-9 has already been applied");
    // the reason codes are distinct and stable
    expect(rejectionOf(staleInteraction)).not.toBe(rejectionOf(staleTask));
    expect(rejectionOf(staleInteraction)).not.toBe(rejectionOf(duplicate));
    expect(rt.committed).toEqual(base);
    // a current event still commits — and only once
    rt.receiveStateSnapshot(base);
    expect(rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 3 })).ok).toBe(true);
    expect(rt.committed.appliedEventIds.filter((id) => id === "ev-1")).toHaveLength(1);
  });

  it("TypeScript test: equal state/event pairs produce deeply equal next-state and transition outputs", () => {
    const first = reduceEvent(initialCommitted(), validEvent());
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.reason);
    const second = reduceEvent(initialCommitted(), validEvent());
    expect(second).toEqual(first);
    const event = validEvent({ eventId: "ev-2", interactionRevision: 3, payload: "second response" });
    expect(reduceEvent(first.next, event)).toEqual(reduceEvent(first.next, event));
    // machine-level repeatability: independent runtimes fed the same sequence agree deeply
    const run = (): CommittedState => {
      const rt = createInteractionRuntime(initialCommitted());
      expect(rt.submit(validEvent()).ok).toBe(true);
      expect(rt.submit(validEvent({ eventId: "ev-2", interactionRevision: 3, payload: "second response" })).ok).toBe(true);
      return rt.committed;
    };
    expect(run()).toEqual(run());
  });

  it("TypeScript test: replayed sequence reconstructs the exact final state and version", () => {
    const initial = initialCommitted();
    const rt = createInteractionRuntime(initial);
    const events = [
      validEvent({ eventId: "ev-1", interactionRevision: 2 }),
      validEvent({ eventId: "ev-2", interactionRevision: 3, payload: "second response" }),
      validEvent({ eventId: "ev-3", interactionRevision: 4, payload: "third response" }),
    ];
    for (const event of events) {
      const r = rt.submit(event);
      expect(r.ok).toBe(true);
    }
    const replay = replayLog(initial, events);
    expect(replay.rejected).toHaveLength(0);
    expect(replay.committed).toEqual(rt.committed);
    expect(replay.committed.interactionRevision).toBe(5);
    expect(replay.committed.contractVersion).toBe(CONTRACT_VERSION);
  });

  it("TypeScript test: cancel/dismiss/expire/supersede produce their defined event types and do not fabricate response payloads", () => {
    const cases: [CommittedState["interactionKind"], InteractionEventType, string][] = [
      ["confirmation", "cancel", "cancelled"],
      ["confirmation", "dismiss", "dismissed"],
      ["confirmation", "expire", "expired"],
      ["delegation", "supersede", "superseded"],
    ];
    for (const [kind, eventType, outcome] of cases) {
      expect(EVENT_TYPES).toContain(eventType);
      const rt = createInteractionRuntime(initialCommitted({ interactionKind: kind }));
      const r = rt.submit(validEvent({ eventType, eventId: `ev-${eventType}` }));
      expect(r.ok).toBe(true);
      expect(rt.state).toBe("retired");
      expect(rt.committed.retired).toBe(true);
      expect(rt.committed.retiredOutcome).toBe(outcome);
      // no fabricated answer: lifecycle outcomes carry an outcome record, never a response payload
      expect(rt.committed.responses).toHaveLength(0);
      expect(rt.committed.outcomes).toHaveLength(1);
      expect(Object.keys(rt.committed.outcomes[0] ?? {})).toEqual(["eventId", "outcome"]);
      expect(rt.committed.outcomes[0]?.outcome).toBe(outcome);
    }
  });

  it("TypeScript test: mutations of a copied render projection cannot affect committed or authorized state", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.submit(validEvent()).ok).toBe(true);
    const before = rt.committed;
    const projection = projectRender(before);
    expect(projection.responses).not.toBe(before.responses);
    projection.revision = 999;
    projection.retired = true;
    projection.retiredOutcome = "cancelled";
    projection.responses[0] = { eventId: "tampered", payload: "injected" };
    projection.responses.push({ eventId: "extra", payload: "extra" });
    projection.outcomes.push({ eventId: "extra", outcome: "cancelled" });
    expect(rt.committed).toEqual(before);
    expect(rt.committed.responses[0]?.eventId).toBe("ev-1");
    expect(rt.committed.retired).toBe(false);
    // the projection carries no authority surface at all
    expect(Object.keys(projection)).toEqual([
      "interactionId",
      "interactionKind",
      "revision",
      "retired",
      "retiredOutcome",
      "responses",
      "outcomes",
    ]);
  });

  it("TypeScript test: only one response against a given interaction revision commits; a concurrent response becomes stale", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 2 })).ok).toBe(true);
    expect(rt.committed.responses).toHaveLength(1);
    // a concurrent response against the same revision is stale, not silently applied
    const concurrent = rt.submit(
      validEvent({ eventId: "ev-2", interactionRevision: 2, payload: "concurrent answer" }),
    );
    expect(concurrent.ok).toBe(false);
    expect(rejectionOf(concurrent)).toContain("stale_interaction_revision: event expects 2, committed is 3");
    expect(rt.committed.responses).toHaveLength(1);
    // after the refreshed revision the response commits
    const refreshed = afterResponse(initialCommitted(), validEvent({ eventId: "ev-1", interactionRevision: 2 }));
    rt.receiveStateSnapshot(refreshed);
    expect(rt.submit(validEvent({ eventId: "ev-2", interactionRevision: 3, payload: "concurrent answer" })).ok).toBe(true);
    expect(rt.committed.responses).toHaveLength(2);
    // the commit precondition is a pure compare-and-swap view of the committed state
    const pre = commitPreconditionsSatisfied(
      refreshed,
      validEvent({ eventId: "ev-3", interactionRevision: 3, taskRevision: 5 }),
    );
    expect(pre.ok).toBe(true);
    const stale = commitPreconditionsSatisfied(refreshed, validEvent({ interactionRevision: 2 }));
    expect(stale.ok).toBe(false);
  });

  it("TypeScript test: applied event does not re-enter active processing without next event or explicit poll", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.submit(validEvent()).ok).toBe(true);
    expect(rt.state).toBe("applied");
    // no next event, no poll: the runtime does not silently return to active
    expect(rt.state).toBe("applied");
    // an explicit poll request returns it to active processing
    expect(rt.poll().ok).toBe(true);
    expect(rt.state).toBe("active");
    // a next event re-enters active processing through the same guard
    const rt2 = createInteractionRuntime(initialCommitted());
    expect(rt2.submit(validEvent()).ok).toBe(true);
    expect(rt2.submit(validEvent({ eventId: "ev-2", interactionRevision: 3 })).ok).toBe(true);
    expect(rt2.state).toBe("applied");
    expect(rt2.committed.responses).toHaveLength(2);
  });

  it("TypeScript test: stale precondition rejection can retry only after refreshed committed state is received", () => {
    const base = initialCommitted({ interactionRevision: 9, appliedEventIds: ["ev-0", "ev-5"] });
    const rt = createInteractionRuntime(base);
    expect(rt.submit(validEvent()).ok).toBe(false);
    expect(rt.state).toBe("rejected_commit");
    // retry before any refreshed snapshot is refused with the precise guard reason
    const early = rt.submit(validEvent({ interactionRevision: 9 }));
    expect(early.ok).toBe(false);
    expect(rejectionOf(early)).toBe(
      "guard state_refresh_received does not hold: no refreshed committed-state snapshot has been received",
    );
    expect(rt.state).toBe("rejected_commit");
    expect(rt.committed).toEqual(base);
    // refreshed committed state arrives → the retry proceeds
    rt.receiveStateSnapshot(base);
    const retried = rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 9 }));
    expect(retried.ok).toBe(true);
    expect(rt.state).toBe("applied");
  });

  it("TypeScript test: active interaction retires only on a permitted explicit lifecycle event", () => {
    const rt = createInteractionRuntime(initialCommitted());
    // a response event commits a response; it never retires the interaction
    expect(rt.submit(validEvent({ eventType: "respond" })).ok).toBe(true);
    expect(rt.state).toBe("applied");
    expect(rt.committed.retired).toBe(false);
    // an unpermitted lifecycle event is refused and leaves the interaction active
    const rt2 = createInteractionRuntime(initialCommitted());
    const blocked = rt2.submit(validEvent({ eventType: "supersede" }));
    expect(blocked.ok).toBe(false);
    expect(rejectionOf(blocked)).toBe(
      "guard retirement_requested does not hold: supersede is not a permitted lifecycle event for interaction kind confirmation",
    );
    expect(rt2.state).toBe("active");
    expect(rt2.committed.retired).toBe(false);
    // a permitted lifecycle event retires explicitly
    expect(rt2.submit(validEvent({ eventType: "cancel" })).ok).toBe(true);
    expect(rt2.state).toBe("retired");
    // a retired interaction accepts nothing further
    const again = rt2.submit(validEvent({ eventId: "ev-9" }));
    expect(again.ok).toBe(false);
    expect(rejectionOf(again)).toBe("retired_interaction: the interaction is retired; no further events are accepted");
    expect(isLifecycle("cancel")).toBe(true);
    expect(isLifecycle("respond")).toBe(false);
  });

});
