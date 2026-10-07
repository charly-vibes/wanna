// Purpose: property tests for event-envelope identity and origin correlation
// Responsibilities: event_identity_unique_holds and event_origin_correlated_holds as vitest tests;
//   names match the contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/event-envelope/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { payloadSchemaChecked } from "../../src/event-envelope/schema";
import { originCorrelated } from "../../src/event-envelope/schema";
import { createEnvelopeMachine } from "../../src/event-envelope/machine";
import { validEnvelope, validContext } from "./fixtures";
import type { EventEnvelope } from "../../src/event-envelope/types";

const ORIGIN_FIELDS = [
  "sessionId",
  "taskId",
  "interactionId",
  "contractRevision",
  "eventId",
  "expectedTaskRevision",
] as const;

describe("event-envelope identity and correlation properties", () => {
  it("TypeScript conformance test: assert invariant event_identity_unique at its trust boundary and under its stated edge cases.", () => {
    // every event carries a non-empty event id — missing or empty ids never enter the model
    expect(payloadSchemaChecked(validEnvelope()).ok).toBe(true);
    expect(payloadSchemaChecked(validEnvelope({ eventId: "" })).reason).toBe("missing event id");
    // the event type is stable: only declared types validate, unknown types are named exactly
    expect(payloadSchemaChecked(validEnvelope({ eventType: "widget.click" })).reason).toBe(
      "unsupported event type: widget.click",
    );
    // uniqueness is enforced at the trust boundary: a committed id cannot commit again…
    const first = createEnvelopeMachine(validEnvelope(), validContext());
    first.fire("validate_event");
    expect(first.fire("commit_event").ok).toBe(true);
    // …and the same id routed through the model again lands in duplicate, not a second commit
    const replay = createEnvelopeMachine(
      validEnvelope(),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    replay.fire("validate_event");
    expect(replay.fire("commit_event").ok).toBe(false);
    expect(replay.fire("ignore_duplicate").ok).toBe(true);
    expect(replay.state).toBe("duplicate");
    // distinct ids each commit independently
    const second = createEnvelopeMachine(
      validEnvelope({ eventId: "evt-2" }),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    second.fire("validate_event");
    expect(second.fire("commit_event").ok).toBe(true);
    expect(second.state).toBe("committed");
  });

  it("TypeScript conformance test: assert invariant event_origin_correlated at its trust boundary and under its stated edge cases.", () => {
    // a fully correlated response event passes
    expect(originCorrelated(validEnvelope()).ok).toBe(true);
    // dropping any one of the six origin fields fails with the exact field name
    for (const field of ORIGIN_FIELDS) {
      const broken: EventEnvelope = { ...validEnvelope(), [field]: "" };
      expect(originCorrelated(broken).reason).toBe(
        `missing origin correlation field: ${field}`,
      );
    }
    // correlation is checked at the commit boundary: an uncorrelated event validates…
    const uncorrelated = validEnvelope({ contractRevision: "" });
    const m = createEnvelopeMachine(uncorrelated, validContext());
    expect(m.fire("validate_event").ok).toBe(true);
    // …but can never commit
    const r = m.fire("commit_event");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard event_origin_correlated does not hold: missing origin correlation field: contractRevision",
    );
    expect(m.state).toBe("validated");
  });
});