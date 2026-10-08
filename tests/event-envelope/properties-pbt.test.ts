// Purpose: fast-check property-based tests for the event-envelope layer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/event-envelope/spec.md);
//   contracts bind via `vitest run tests/event-envelope/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { DECLARED_EVENT_TYPES, reduceEvent } from "../../src/event-envelope/index";
import type { EnvelopeContext, EventEnvelope } from "../../src/event-envelope/index";
import { validContext, validEnvelope } from "./fixtures";

const nonEmpty = fc.string({ minLength: 1 }).filter((s) => s.trim() !== "");

// plain-object payloads with bounded scalars — always schema-valid at ingress
const payloadArb = fc.dictionary(
  fc.stringMatching(/^[a-z]{1,8}$/),
  fc.oneof(fc.string({ maxLength: 64 }), fc.integer({ max: 1e6 })),
  { maxKeys: 6 },
);

const envelopeArb: fc.Arbitrary<EventEnvelope> = fc
  .record({
    eventId: nonEmpty,
    eventType: fc.constantFrom(...DECLARED_EVENT_TYPES),
    source: nonEmpty,
    sessionId: nonEmpty,
    taskId: nonEmpty,
    interactionId: nonEmpty,
    contractRevision: nonEmpty,
    expectedTaskRevision: nonEmpty,
    payload: payloadArb,
  })
  .map((r) => validEnvelope(r));

const contextArb: fc.Arbitrary<EnvelopeContext> = fc
  .record({
    committedEventIds: fc.array(nonEmpty, { maxLength: 10 }),
    currentTaskRevision: nonEmpty,
    authorizedSources: fc.array(nonEmpty, { minLength: 1, maxLength: 5 }),
  })
  .map((r) => validContext(r));

describe("event-envelope properties (fast-check)", () => {
  it("TypeScript conformance test: assert invariant duplicate_idempotent at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(envelopeArb, contextArb, (envelope, context) => {
        const first = reduceEvent(envelope, context);
        if (!(first.ok && first.state === "committed")) return;
        // replaying the same envelope against a context that already committed it is idempotent:
        // a duplicate state with NO second mutation and NO second effect intent
        const replay = reduceEvent(envelope, { ...context, committedEventIds: [...context.committedEventIds, envelope.eventId] });
        expect(replay).toEqual({ ok: true, state: "duplicate", effects: [] });
        expect(replay.ok && replay.effects).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript conformance test: assert invariant stale_events_rejected at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(envelopeArb, contextArb, (envelope, context) => {
        // a stale event names an expected task revision that is not the current revision;
        // staleness is only reachable for an authorized source (that gate runs first)
        const stale = { ...envelope, expectedTaskRevision: context.currentTaskRevision + "-stale" };
        const outcome = reduceEvent(stale, { ...context, authorizedSources: [envelope.source] });
        expect(outcome).toMatchObject({ ok: false, code: "stale_revision" });
        if (!outcome.ok) expect(outcome.reason).toMatch(/never silently applied/);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript conformance test: assert invariant reducer_pure at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(envelopeArb, contextArb, (envelope, context) => {
        // purity: identical inputs produce identical outcomes — no clock, no randomness, no I/O
        expect(reduceEvent(envelope, context)).toEqual(reduceEvent(envelope, context));
      }),
      { numRuns: 100 },
    );
  });
});
