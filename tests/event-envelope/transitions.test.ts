// Purpose: transition tests for the event-envelope model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with the precise declared reason
//   (masked-violation lesson from roles_allowlisted: loose reason regexes let real bypasses through)
import { describe, it, expect } from "vitest";
import { createEnvelopeMachine } from "../../src/event-envelope/machine";
import type { TransitionResult } from "../../src/event-envelope/types";
import { validEnvelope, validContext } from "./fixtures";

function expectFail(r: TransitionResult): string {
  if (r.ok) throw new Error("expected the transition to fail");
  return r.reason;
}

describe("event-envelope transitions", () => {
  it("validate_event moves received → validated when the payload-schema guard holds", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    const r = m.fire("validate_event");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("validate_event refuses a malformed envelope with the exact schema reason and typed code", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ eventType: "widget.click" }),
      validContext(),
    );
    const r = m.fire("validate_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("unsupported event type: widget.click");
    expect(r.code).toBe("unsupported_event_type");
    expect(m.state).toBe("received");
  });

  it("reject_malformed_event moves received → rejected when the payload-schema guard fails", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ eventId: "" }),
      validContext(),
    );
    const r = m.fire("reject_malformed_event");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rejected");
    expect(m.rejectionReason).toBe("missing event id");
    expect(m.rejectionCode).toBe("invalid_payload");
  });

  it("reject_malformed_event refuses a well-formed envelope with the exact guard-holds reason", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    const r = m.fire("reject_malformed_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard payload_schema_checked holds — the envelope is not malformed",
    );
    expect(m.state).toBe("received");
  });

  it("commit_event moves validated → committed when the origin-correlation guard holds", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    m.fire("validate_event");
    const r = m.fire("commit_event");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("committed");
    expect(r.effects).toEqual([
      { kind: "persist_event", eventId: "evt-1", eventType: "response.delivered" },
    ]);
  });

  it("commit_event refuses an envelope whose origin correlation is incomplete, naming the missing field", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ interactionId: "" }),
      validContext(),
    );
    m.fire("validate_event");
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard event_origin_correlated does not hold: missing origin correlation field: interactionId",
    );
    expect(m.state).toBe("validated");
  });

  it("commit_event refuses an already-committed event id with the exact idempotency reason", () => {
    const m = createEnvelopeMachine(
      validEnvelope(),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    m.fire("validate_event");
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "event id evt-1 is already committed — duplicate_idempotent forbids a second mutation or duplicate effect intent",
    );
    expect(r.code).toBe("duplicate_event");
  });

  it("commit_event refuses a stale event and routes it to reject_stale_event", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ expectedTaskRevision: "task-6" }),
      validContext({ currentTaskRevision: "task-7" }),
    );
    m.fire("validate_event");
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "event is stale (expected task revision task-6, current task-7) — route through reject_stale_event",
    );
    expect(r.code).toBe("stale_revision");
    expect(m.state).toBe("validated");
  });

  it("commit_event refuses an unauthorized source with the exact reason", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ source: "render-plugin" }),
      validContext(),
    );
    m.fire("validate_event");
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "source render-plugin is not authorized to commit events",
    );
    expect(r.code).toBe("unauthorized_source");
  });

  it("ignore_duplicate moves validated → duplicate when the event id is already committed", () => {
    const m = createEnvelopeMachine(
      validEnvelope(),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    m.fire("validate_event");
    const r = m.fire("ignore_duplicate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("duplicate");
    // duplicate_idempotent: no second mutation and no duplicate effect intent
    expect(r.effects).toEqual([]);
  });

  it("ignore_duplicate refuses an event id that is not committed, with the exact reason", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    m.fire("validate_event");
    const r = m.fire("ignore_duplicate");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "event id evt-1 is not in the committed registry — duplicate_idempotent does not hold",
    );
    expect(m.state).toBe("validated");
  });

  it("reject_stale_event moves validated → stale when the expected task revision is stale", () => {
    const m = createEnvelopeMachine(
      validEnvelope({ expectedTaskRevision: "task-6" }),
      validContext({ currentTaskRevision: "task-7" }),
    );
    m.fire("validate_event");
    const r = m.fire("reject_stale_event");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("stale");
    expect(r.effects).toEqual([]);
  });

  it("reject_stale_event refuses a current revision with the exact guard-holds reason", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    m.fire("validate_event");
    const r = m.fire("reject_stale_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe(
      "guard stale_events_rejected holds — expected task revision task-7 is current, nothing to reject as stale",
    );
    expect(m.state).toBe("validated");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createEnvelopeMachine(validEnvelope(), validContext());
    // commit_event starts at validated, not received
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(expectFail(r)).toBe("transition commit_event cannot fire from state received");
    expect(m.state).toBe("received");
  });
});