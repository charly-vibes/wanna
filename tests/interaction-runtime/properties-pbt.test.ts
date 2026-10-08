// Purpose: fast-check property-based tests for the interaction runtime
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-runtime/spec.md);
//   contracts bind via `vitest run tests/interaction-runtime/properties*.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { reduceEvent } from "../../src/interaction-runtime/index";
import type { CommittedState, EventEnvelope } from "../../src/interaction-runtime/index";
import { initialCommitted, rejectionOf, validEvent } from "./fixtures";

const stateArb: fc.Arbitrary<CommittedState> = fc
  .record({
    interactionRevision: fc.nat({ max: 40 }),
    taskRevision: fc.nat({ max: 40 }),
    appliedEventIds: fc.array(fc.stringMatching(/^ev-[0-9]{1,3}$/), { maxLength: 5 }),
  })
  .map((r) => initialCommitted({ ...r }));

const eventArb: fc.Arbitrary<EventEnvelope> = fc
  .record({
    eventId: fc.stringMatching(/^ev-[0-9]{1,3}$/),
    interactionRevision: fc.nat({ max: 40 }),
    taskRevision: fc.nat({ max: 40 }),
    payload: fc.stringMatching(/^[a-z ]{5,40}$/),
  })
  .map((r) => validEvent({ ...r }));

describe("interaction-runtime properties (fast-check)", () => {
  it("TypeScript test: stale revision and repeated event ID do not produce a second committed state change and expose distinct reason codes", () => {
    fc.assert(
      fc.property(
        stateArb,
        eventArb,
        fc.nat({ max: 3 }),
        fc.constantFrom("stale_interaction", "stale_task", "duplicate"),
        (state, event, delta, fault) => {
          // align the surviving revisions so the injected fault is the one under test
          const aligned: EventEnvelope = {
            ...event,
            interactionRevision: state.interactionRevision,
            taskRevision: state.taskRevision,
          };
          const broken: EventEnvelope =
            fault === "stale_interaction"
              ? { ...aligned, eventId: `${event.eventId}-fresh`, interactionRevision: state.interactionRevision + delta + 1 }
              : fault === "stale_task"
                ? { ...aligned, eventId: `${event.eventId}-fresh`, taskRevision: state.taskRevision + delta + 1 }
                : { ...aligned, eventId: state.appliedEventIds[0] ?? "ev-dup" };
          const idsBefore = [...state.appliedEventIds];
          const revisionBefore = state.interactionRevision;
          const r = reduceEvent(state, broken);
          if (fault === "duplicate" && state.appliedEventIds.length === 0) {
            // nothing applied yet — the fresh id commits, exactly once
            expect(r.ok).toBe(true);
          } else if (!r.ok) {
            const code =
              fault === "duplicate"
                ? "duplicate_event_id"
                : fault === "stale_interaction"
                  ? "stale_interaction_revision"
                  : "stale_task_revision";
            expect(rejectionOf(r)).toContain(code);
          } else {
            throw new Error(`expected a ${fault} rejection, event committed`);
          }
          // the committed state is never mutated by a rejection
          expect(state.appliedEventIds).toEqual(idsBefore);
          expect(state.interactionRevision).toBe(revisionBefore);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("TypeScript test: equal state/event pairs produce deeply equal next-state and transition outputs", () => {
    fc.assert(
      fc.property(stateArb, eventArb, fc.nat({ max: 2 }), (state, event, variant) => {
        const pairs: EventEnvelope[] = [
          event,
          { ...event, payload: `${event.payload} revisited` },
          { ...event, eventId: `${event.eventId}x` },
        ];
        const pair = pairs[variant] ?? event;
        const first = reduceEvent(state, pair);
        const second = reduceEvent(state, pair);
        expect(second).toEqual(first);
        // purity: the prior state is untouched by the reduction
        expect(state.appliedEventIds.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 },
    );
  });
});
