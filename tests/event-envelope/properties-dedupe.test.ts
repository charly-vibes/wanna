// Purpose: property tests for event-envelope deduplication and staleness
// Responsibilities: duplicate_idempotent_holds and stale_events_rejected_holds as vitest tests;
//   names match the contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/event-envelope/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { reduceEvent } from "../../src/event-envelope/reducer";
import { createEnvelopeMachine } from "../../src/event-envelope/machine";
import { validEnvelope, validContext } from "./fixtures";

describe("event-envelope dedupe and staleness properties", () => {
  it("TypeScript conformance test: assert invariant duplicate_idempotent at its trust boundary and under its stated edge cases.", () => {
    // first processing commits exactly one effect intent
    const first = reduceEvent(validEnvelope(), validContext());
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.state).toBe("committed");
      expect(first.effects).toEqual([
        { kind: "persist_event", eventId: "evt-1", eventType: "response.delivered" },
      ]);
    }
    // reprocessing the same event id produces no second mutation and no duplicate effect intent
    const replay = reduceEvent(
      validEnvelope(),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.state).toBe("duplicate");
      expect(replay.effects).toEqual([]);
    }
    // the machine path agrees: validate → ignore_duplicate lands in duplicate with zero effects,
    // and commit_event is refused outright so a second mutation is unreachable
    const m = createEnvelopeMachine(
      validEnvelope(),
      validContext({ committedEventIds: ["evt-1"] }),
    );
    m.fire("validate_event");
    expect(m.fire("commit_event").ok).toBe(false);
    const dup = m.fire("ignore_duplicate");
    expect(dup.ok).toBe(true);
    expect(m.state).toBe("duplicate");
    expect(dup.effects).toEqual([]);
  });

  it("TypeScript conformance test: assert invariant stale_events_rejected at its trust boundary and under its stated edge cases.", () => {
    const stale = validEnvelope({ expectedTaskRevision: "task-6" });
    const context = validContext({ currentTaskRevision: "task-7" });
    // the reducer returns a typed rejection naming both revisions — never a silent apply
    const outcome = reduceEvent(stale, context);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("stale_revision");
      expect(outcome.reason).toBe(
        "expected task revision task-6 is stale (current task-7) — the event is never silently applied to the newer revision",
      );
    }
    // the machine records the stale outcome explicitly
    const m = createEnvelopeMachine(stale, context);
    m.fire("validate_event");
    expect(m.fire("commit_event").ok).toBe(false);
    expect(m.fire("reject_stale_event").ok).toBe(true);
    expect(m.state).toBe("stale");
    // an event whose expected revision matches the current one is not stale — it commits
    const current = reduceEvent(validEnvelope(), context);
    expect(current.ok).toBe(true);
    // reconciliation is explicit: a re-issued event carrying the current revision applies
    const reconciled = validEnvelope({ expectedTaskRevision: "task-7" });
    expect(reduceEvent(reconciled, context).ok).toBe(true);
  });
});