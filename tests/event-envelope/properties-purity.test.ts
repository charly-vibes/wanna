// Purpose: property tests for reducer purity and typed rejection codes
// Responsibilities: reducer_pure_holds and rejection_typed_holds as vitest tests;
//   names match the contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/event-envelope/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { reduceEvent } from "../../src/event-envelope/reducer";
import { createEnvelopeMachine } from "../../src/event-envelope/machine";
import { RESULT_CODES } from "../../src/event-envelope/types";
import { validEnvelope, validContext } from "./fixtures";
import type { EnvelopeContext, EventEnvelope, ResultCode, ReduceOutcome } from "../../src/event-envelope/types";

describe("event-envelope purity and rejection-typing properties", () => {
  it("TypeScript conformance test: assert invariant reducer_pure at its trust boundary and under its stated edge cases.", () => {
    // the reducer takes only its declared inputs (no clock, no random, no I/O), so identical
    // inputs must yield identical outputs across arbitrarily many invocations
    const envelope: EventEnvelope = structuredClone(validEnvelope());
    const context: EnvelopeContext = structuredClone(validContext());
    const outcomes: ReduceOutcome[] = [];
    for (let i = 0; i < 25; i++) {
      outcomes.push(reduceEvent(envelope, context));
    }
    for (const outcome of outcomes) {
      expect(outcome).toEqual(outcomes[0]);
    }
    expect(outcomes[0]?.ok).toBe(true);
    // purity holds on the rejection paths too: same malformed input, same typed rejection
    const malformed = structuredClone(validEnvelope({ eventType: "widget.click" }));
    const rejections: ReduceOutcome[] = [];
    for (let i = 0; i < 25; i++) {
      rejections.push(reduceEvent(malformed, context));
    }
    for (const outcome of rejections) {
      expect(outcome).toEqual(rejections[0]);
    }
    // the committed result carries no volatile provenance — only the declared effect intent
    if (outcomes[0]?.ok) {
      expect(JSON.stringify(outcomes[0])).toBe(
        JSON.stringify({
          ok: true,
          state: "committed",
          effects: [
            { kind: "persist_event", eventId: "evt-1", eventType: "response.delivered" },
          ],
        }),
      );
    }
  });

  it("TypeScript conformance test: assert invariant rejection_typed at its trust boundary and under its stated edge cases.", () => {
    // the declared code set is exactly the five rejection classes, all distinct
    expect([...RESULT_CODES]).toEqual([
      "invalid_payload",
      "duplicate_event",
      "stale_revision",
      "unauthorized_source",
      "unsupported_event_type",
    ]);
    expect(new Set<string>(RESULT_CODES).size).toBe(RESULT_CODES.length);
    // each class is reachable with its own stable code
    const observed = new Map<ResultCode, string>();
    function record(outcome: ReduceOutcome): void {
      if (!outcome.ok) observed.set(outcome.code, outcome.reason);
    }
    const cases: readonly [EventEnvelope, EnvelopeContext][] = [
      // invalid payload
      [validEnvelope({ payload: null }), validContext()],
      // unsupported event type
      [validEnvelope({ eventType: "widget.click" }), validContext()],
      // stale revision
      [validEnvelope({ expectedTaskRevision: "task-6" }), validContext({ currentTaskRevision: "task-7" })],
      // unauthorized source
      [validEnvelope({ source: "render-plugin" }), validContext()],
    ];
    for (const [envelope, context] of cases) {
      record(reduceEvent(envelope, context));
    }
    // the duplicate class is emitted by the commit guard when a committed id tries to commit again
    const dup = createEnvelopeMachine(validEnvelope(), validContext({ committedEventIds: ["evt-1"] }));
    dup.fire("validate_event");
    record(dup.fire("commit_event"));
    expect(observed.size).toBe(RESULT_CODES.length);
    for (const code of RESULT_CODES) {
      expect(observed.get(code)).toBeTruthy();
    }
  });
});