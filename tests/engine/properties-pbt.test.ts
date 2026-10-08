// Purpose: fast-check property-based tests for the interaction-engine core
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-engine/spec.md);
//   contracts bind via `vitest run tests/engine/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { createEngine, evaluate } from "../../src/engine/index";
import type { Candidate, ContextSnapshot, Policy } from "../../src/engine/index";

const nonEmpty = fc.string({ minLength: 1 }).filter((s) => s.trim() !== "");

const contextArb: fc.Arbitrary<ContextSnapshot> = fc.record({
  taskId: nonEmpty,
  taskRevision: fc.nat({ max: 1_000_000 }),
  need: nonEmpty,
  catalogVersion: nonEmpty,
  policyVersion: nonEmpty,
});

const policyArb: fc.Arbitrary<Policy> = fc.record({
  version: nonEmpty,
  candidates: fc.array(fc.record({ id: nonEmpty, priority: fc.integer({ min: -100, max: 100 }) }), {
    maxLength: 24,
  }),
});

function prioritiesDescThenIdsAsc(cs: readonly Candidate[]): boolean {
  return cs.every((c, i) =>
    i === 0 ||
    cs[i - 1]!.priority > c.priority ||
    (cs[i - 1]!.priority === c.priority && cs[i - 1]!.id <= c.id),
  );
}

function multisetEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  const canon = (xs: readonly T[]) => xs.map((x) => JSON.stringify(x)).sort();
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

describe("interaction-engine properties (fast-check)", () => {
  it("TypeScript test: repeated evaluation returns deeply equal ordered results", () => {
    fc.assert(
      fc.property(contextArb, policyArb, (ctx, pol) => {
        const a = evaluate(ctx, pol);
        const b = evaluate(ctx, pol);
        expect(a).toEqual(b);
        if (!a.ok) return;
        const value = a.value;
        // provenance echoes the pinned inputs verbatim
        expect(value.taskId).toBe(ctx.taskId);
        expect(value.taskRevision).toBe(ctx.taskRevision);
        expect(value.need).toBe(ctx.need);
        expect(value.catalogVersion).toBe(ctx.catalogVersion);
        expect(value.policyVersion).toBe(pol.version);
        // candidates are exactly the positively-prioritized candidates, in priority-desc/id-asc order
        expect(multisetEqual(value.candidates, pol.candidates.filter((c) => c.priority > 0))).toBe(true);
        expect(prioritiesDescThenIdsAsc(value.candidates)).toBe(true);
        // exclusions are exactly the non-positive candidates, with the stable reason code
        expect(multisetEqual(value.exclusions.map((e) => e.id), pol.candidates.filter((c) => c.priority <= 0).map((c) => c.id))).toBe(true);
        expect(value.exclusions.every((e) => e.reasonCode === "priority_not_positive")).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript test: task revision change between evaluation and commit prevents commit and preserves prior committed state", () => {
    fc.assert(
      fc.property(contextArb, policyArb, fc.integer({ min: 1, max: 100 }), (ctx, pol, bumps) => {
        const e = createEngine();
        expect(e.acceptContext(ctx, pol).ok).toBe(true);
        expect(e.evaluate().ok).toBe(true);
        for (let i = 0; i < bumps; i++) e.receiveRevisionBump();
        // the stale refusal IS the reject_stale_decision transition — committed state is untouched
        expect(e.commit().ok).toBe(true);
        expect(e.state).toBe("stale_context");
        expect(e.committedDecision).toBeUndefined();
        expect(e.log.map((t) => t.id)).toEqual([
          "accept_context",
          "evaluate_pinned_context",
          "reject_stale_decision",
        ]);
      }),
      { numRuns: 100 },
    );
  });
});
