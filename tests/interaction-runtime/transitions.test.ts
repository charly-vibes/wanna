// Purpose: transition tests for the interaction-runtime model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with precise failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with exact reasons, not loose matches
import { describe, it, expect } from "vitest";
import { createInteractionRuntime } from "../../src/interaction-runtime/machine";
import { initialCommitted, rejectionOf, validEvent } from "./fixtures";
import type { TransitionId } from "../../src/interaction-runtime/types";

describe("interaction-runtime transitions", () => {
  it("validate_envelope moves active → validated when event_envelope_valid holds", () => {
    const rt = createInteractionRuntime(initialCommitted());
    const r = rt.fire("validate_envelope", validEvent());
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("validated");
  });

  it("validate_envelope refuses to fire when event_envelope_valid fails, naming the envelope defect", () => {
    const rt = createInteractionRuntime(initialCommitted());
    const r = rt.fire("validate_envelope", validEvent({ eventId: "" }));
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe("guard event_envelope_valid does not hold: missing event id");
    expect(rt.state).toBe("active");
  });

  it("reject_malformed_envelope moves active → malformed_event when event_envelope_valid fails, naming the defect", () => {
    const rt = createInteractionRuntime(initialCommitted());
    const r = rt.fire("reject_malformed_envelope", validEvent({ interactionId: "" }));
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("malformed_event");
    expect(rt.malformedReason).toBe("missing interaction id");
  });

  it("reject_malformed_envelope refuses to fire when the envelope is actually valid", () => {
    const rt = createInteractionRuntime(initialCommitted());
    const r = rt.fire("reject_malformed_envelope", validEvent());
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe("guard ¬event_envelope_valid does not hold: the event envelope is valid");
    expect(rt.state).toBe("active");
  });

  it("apply_current_event moves validated → applied when event_commit_preconditions_satisfied holds", () => {
    const rt = createInteractionRuntime(initialCommitted());
    rt.fire("validate_envelope", validEvent());
    const r = rt.fire("apply_current_event");
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("applied");
    expect(rt.committed.interactionRevision).toBe(3);
    expect(rt.committed.appliedEventIds).toEqual(["ev-0", "ev-1"]);
  });

  it("apply_current_event refuses to fire when the commit preconditions fail, naming the stale defect", () => {
    const rt = createInteractionRuntime(
      initialCommitted({ interactionRevision: 3, appliedEventIds: ["ev-0", "ev-9"] }),
    );
    rt.fire("validate_envelope", validEvent({ interactionRevision: 2 }));
    const r = rt.fire("apply_current_event");
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe(
      "guard event_commit_preconditions_satisfied does not hold: stale_interaction_revision: event expects 2, committed is 3",
    );
    expect(rt.state).toBe("validated");
    expect(rt.committed.interactionRevision).toBe(3);
  });

  it("reject_stale_or_duplicate moves validated → rejected_commit when the commit preconditions fail, recording the reason", () => {
    const rt = createInteractionRuntime(
      initialCommitted({ interactionRevision: 3, appliedEventIds: ["ev-0", "ev-9"] }),
    );
    rt.fire("validate_envelope", validEvent({ eventId: "ev-9", interactionRevision: 3 }));
    const r = rt.fire("reject_stale_or_duplicate");
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("rejected_commit");
    expect(rt.rejectionReason).toBe("duplicate_event_id: event ev-9 has already been applied");
  });

  it("reject_stale_or_duplicate refuses to fire when the commit preconditions are satisfied", () => {
    const rt = createInteractionRuntime(initialCommitted());
    rt.fire("validate_envelope", validEvent());
    const r = rt.fire("reject_stale_or_duplicate");
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe(
      "guard ¬event_commit_preconditions_satisfied does not hold: the commit preconditions are satisfied",
    );
    expect(rt.state).toBe("validated");
  });

  it("continue_after_apply moves applied → active only when a next event or explicit poll has arrived", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.submit(validEvent()).ok).toBe(true);
    expect(rt.state).toBe("applied");
    const r = rt.fire("continue_after_apply");
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe("guard next_event_received does not hold: no next event or poll request has arrived");
    expect(rt.state).toBe("applied");
    const polled = rt.poll();
    expect(polled.ok).toBe(true);
    expect(rt.state).toBe("active");
  });

  it("retry_with_corrected_event moves malformed_event → active when the corrected envelope is valid", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.fire("reject_malformed_envelope", validEvent({ eventId: "" })).ok).toBe(true);
    const r = rt.fire("retry_with_corrected_event", validEvent());
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("active");
  });

  it("retry_with_corrected_event refuses to fire while the corrected envelope is still invalid", () => {
    const rt = createInteractionRuntime(initialCommitted());
    expect(rt.fire("reject_malformed_envelope", validEvent({ eventId: "" })).ok).toBe(true);
    const r = rt.fire("retry_with_corrected_event", validEvent({ taskId: "" }));
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe("guard event_envelope_valid does not hold: missing task id");
    expect(rt.state).toBe("malformed_event");
  });

  it("retry_after_state_refresh moves rejected_commit → active when a refreshed snapshot has been received", () => {
    const rt = createInteractionRuntime(
      initialCommitted({ interactionRevision: 9, appliedEventIds: ["ev-0", "ev-5"] }),
    );
    expect(rt.submit(validEvent()).ok).toBe(false);
    expect(rt.state).toBe("rejected_commit");
    const r = rt.fire("retry_after_state_refresh");
    expect(r.ok).toBe(false);
    expect(rejectionOf(r)).toBe(
      "guard state_refresh_received does not hold: no refreshed committed-state snapshot has been received",
    );
    rt.receiveStateSnapshot(initialCommitted({ interactionRevision: 9, appliedEventIds: ["ev-0", "ev-5"] }));
    const retried = rt.fire("retry_after_state_refresh");
    expect(retried.ok).toBe(true);
    expect(rt.state).toBe("active");
    expect(rt.committed).toEqual(
      initialCommitted({ interactionRevision: 9, appliedEventIds: ["ev-0", "ev-5"] }),
    );
  });

  it("retire_interaction moves active → retired on a permitted explicit lifecycle event", () => {
    const rt = createInteractionRuntime(initialCommitted());
    const r = rt.fire("retire_interaction", validEvent({ eventType: "cancel" }));
    expect(r.ok).toBe(true);
    expect(rt.state).toBe("retired");
    expect(rt.committed.retired).toBe(true);
    expect(rt.committed.retiredOutcome).toBe("cancelled");
  });

  it("retire_interaction refuses to fire when retirement_requested fails, naming the precise defect", () => {
    const rt = createInteractionRuntime(initialCommitted());
    // supersede is not permitted for a confirmation interaction
    const notPermitted = rt.fire("retire_interaction", validEvent({ eventType: "supersede" }));
    expect(notPermitted.ok).toBe(false);
    expect(rejectionOf(notPermitted)).toBe(
      "guard retirement_requested does not hold: supersede is not a permitted lifecycle event for interaction kind confirmation",
    );
    // respond is not a lifecycle event
    const notLifecycle = rt.fire("retire_interaction", validEvent({ eventType: "respond" }));
    expect(notLifecycle.ok).toBe(false);
    expect(rejectionOf(notLifecycle)).toBe("guard retirement_requested does not hold: respond is not a lifecycle event");
    // the lifecycle event must still carry a valid envelope
    const malformed = rt.fire("retire_interaction", validEvent({ eventType: "cancel", eventId: "" }));
    expect(malformed.ok).toBe(false);
    expect(rejectionOf(malformed)).toBe("guard retirement_requested does not hold: missing event id");
    expect(rt.state).toBe("active");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    // validate/reject_malformed originate from active — drive the runtime to applied first
    for (const id of ["validate_envelope", "reject_malformed_envelope"] as const) {
      const rt = createInteractionRuntime(initialCommitted());
      expect(rt.submit(validEvent()).ok).toBe(true);
      const r = rt.fire(id, validEvent());
      expect(r.ok).toBe(false);
      expect(rejectionOf(r)).toContain(`transition ${id} cannot fire from state applied`);
      expect(rt.state).toBe("applied");
    }
    // the remaining five originate from states other than a fresh active runtime
    // (retire_interaction does originate from active — it is exercised above)
    const inputs: Partial<Record<TransitionId, Parameters<ReturnType<typeof createInteractionRuntime>["fire"]>[1]>> = {
      retry_with_corrected_event: validEvent(),
    };
    for (const id of [
      "apply_current_event",
      "reject_stale_or_duplicate",
      "continue_after_apply",
      "retry_after_state_refresh",
      "retry_with_corrected_event",
    ] as const) {
      const rt = createInteractionRuntime(initialCommitted());
      const r = rt.fire(id, inputs[id]);
      expect(r.ok).toBe(false);
      expect(rejectionOf(r)).toContain(`transition ${id} cannot fire from state active`);
      expect(rt.state).toBe("active");
    }
  });
});
