// Purpose: property tests for event-envelope ingress schema and payload bounds
// Responsibilities: payload_schema_checked_holds and event_payload_bounded_holds as vitest tests;
//   names match the contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/event-envelope/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { payloadSchemaChecked } from "../../src/event-envelope/schema";
import { payloadWithinBounds } from "../../src/event-envelope/bounds";
import { DECLARED_EVENT_TYPES, PAYLOAD_BOUNDS } from "../../src/event-envelope/types";
import { reduceEvent } from "../../src/event-envelope/reducer";
import { createEnvelopeMachine } from "../../src/event-envelope/machine";
import { validEnvelope, validContext } from "./fixtures";

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

describe("event-envelope schema and bounds properties", () => {
  it("TypeScript conformance test: assert invariant payload_schema_checked at its trust boundary and under its stated edge cases.", () => {
    // the well-formed envelope passes the declared schema at ingress
    expect(payloadSchemaChecked(validEnvelope()).ok).toBe(true);
    // every malformed variant is rejected with the exact declared reason
    expect(payloadSchemaChecked(validEnvelope({ eventId: "" })).reason).toBe("missing event id");
    expect(payloadSchemaChecked(validEnvelope({ eventType: "widget.click" })).reason).toBe(
      "unsupported event type: widget.click",
    );
    expect(payloadSchemaChecked(validEnvelope({ payload: "flat string" })).reason).toBe(
      "payload must be a JSON object",
    );
    expect(payloadSchemaChecked(validEnvelope({ payload: null })).reason).toBe(
      "payload must be a JSON object",
    );
    // the declared event types form a closed, stable set — each one validates
    for (const eventType of DECLARED_EVENT_TYPES) {
      expect(payloadSchemaChecked(validEnvelope({ eventType })).ok).toBe(true);
    }
    // schema checking gates the reducer: an invalid envelope is never reduced to committed
    const invalid = validEnvelope({ eventType: "widget.click" });
    const outcome = reduceEvent(invalid, validContext());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("unsupported_event_type");
      expect(outcome.reason).toBe("unsupported event type: widget.click");
    }
    // the machine can only leave received via validated or rejected — never committed
    const m = createEnvelopeMachine(invalid, validContext());
    expect(m.fire("validate_event").ok).toBe(false);
    expect(m.fire("commit_event").ok).toBe(false);
    expect(m.fire("reject_malformed_event").ok).toBe(true);
    expect(m.state).toBe("rejected");
  });

  it("TypeScript conformance test: assert invariant event_payload_bounded at its trust boundary and under its stated edge cases.", () => {
    // byte bound
    const fat = validEnvelope({ payload: { blob: "x".repeat(70000) } });
    const bytes = byteLength(fat.payload);
    expect(bytes).toBeGreaterThan(PAYLOAD_BOUNDS.maxBytes);
    expect(payloadWithinBounds(fat.payload).reason).toBe(
      `payload exceeds byte bound of ${PAYLOAD_BOUNDS.maxBytes} (got ${bytes})`,
    );
    // nesting bound — a value nested ten objects deep (innermost at depth 9) exceeds the depth bound of 8
    const deep: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = deep;
    for (let i = 0; i < 9; i++) {
      const next: Record<string, unknown> = {};
      cursor.a = next;
      cursor = next;
    }
    expect(payloadWithinBounds(deep).reason).toBe(
      `payload nesting at a.a.a.a.a.a.a.a.a exceeds depth bound of ${PAYLOAD_BOUNDS.maxNestingDepth}`,
    );
    // string bound
    expect(payloadWithinBounds({ note: "y".repeat(4097) }).reason).toBe(
      `payload string at note exceeds length bound of ${PAYLOAD_BOUNDS.maxStringLength}`,
    );
    // collection bound
    expect(payloadWithinBounds({ list: Array.from({ length: 257 }, () => 1) }).reason).toBe(
      `payload collection at list exceeds length bound of ${PAYLOAD_BOUNDS.maxCollectionLength}`,
    );
    // numeric bounds — non-finite and out-of-magnitude numbers are rejected
    expect(payloadWithinBounds({ n: Number.POSITIVE_INFINITY }).reason).toBe(
      "payload number at n is not finite",
    );
    expect(payloadWithinBounds({ n: Number.NaN }).reason).toBe(
      "payload number at n is not finite",
    );
    expect(payloadWithinBounds({ n: PAYLOAD_BOUNDS.maxNumericMagnitude + 1 }).reason).toBe(
      `payload number at n exceeds numeric magnitude bound of ${PAYLOAD_BOUNDS.maxNumericMagnitude}`,
    );
    // every bound is enforced at ingress: the bounded machine refuses to validate such payloads
    for (
      const payload of [
        fat.payload,
        deep,
        { note: "y".repeat(4097) },
        { list: Array.from({ length: 257 }, () => 1) },
      ]
    ) {
      const m = createEnvelopeMachine(validEnvelope({ payload }), validContext());
      expect(m.fire("validate_event").ok).toBe(false);
      expect(m.state).toBe("received");
    }
  });
});