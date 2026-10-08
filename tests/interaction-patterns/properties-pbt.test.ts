// Purpose: fast-check property-based tests for the interaction-patterns invariants
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-patterns/spec.md);
//   contracts bind via `vitest run tests/interaction-patterns/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { clarificationHasTarget, resolveReplay } from "../../src/interaction-patterns/index";
import type { PatternDefinition, PatternNode, TransitionRecord } from "../../src/interaction-patterns/index";
import { clarificationPattern, genericPattern, node } from "./fixtures";

const targetArb = fc.option(fc.string({ minLength: 0, maxLength: 40 }), { nil: undefined });

const clarifyNodesArb: fc.Arbitrary<PatternNode[]> = fc
  .array(fc.record({ id: fc.stringMatching(/^ask-[a-z0-9]{0,4}$/), target: targetArb }), { maxLength: 4 })
  .map((entries) => [
    ...entries.map((e) => node({ id: e.id, primitiveId: "primitive.clarify", unresolvedTarget: e.target })),
    node({ id: "apply", primitiveId: "primitive.deliver" }),
  ]);

const historyArb: fc.Arbitrary<TransitionRecord[]> = fc
  .record({
    version: fc.constantFrom("1.0.0", "1.0.1", "2.0.0", "0.9.0"),
    events: fc.array(fc.stringMatching(/^evt-[a-z0-9]{1,4}$/), { maxLength: 6 }),
  })
  .map((r) =>
    r.events.map((id, i) => ({
      id,
      from: "running" as const,
      to: "running" as const,
      patternVersion: i === 0 ? r.version : "1.0.0",
    })),
  );

describe("interaction-patterns properties (fast-check)", () => {
  it("Policy test: clarification without a named unresolved target is ineligible", () => {
    fc.assert(
      fc.property(clarifyNodesArb, (nodes) => {
        const def: PatternDefinition = clarificationPattern({ nodes });
        const targets = nodes.filter((n) => n.primitiveId === "primitive.clarify").map((n) => n.unresolvedTarget);
        const missing = targets.some((t) => t === undefined || t.length === 0);
        const check = clarificationHasTarget(def);
        // eligibility is exactly: every clarification step names a non-empty unresolved target
        expect(check.ok).toBe(!missing);
        if (!check.ok) {
          expect(check.reason).toMatch(/names no unresolved target — ineligible/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Replay test: historical pattern events resolve against the recorded pattern version", () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const def: PatternDefinition = genericPattern({ version: "1.0.0" });
        const check = resolveReplay(def, history);
        const foreign = history.some((e) => e.patternVersion !== def.version);
        // replay resolves only when every recorded event matches the pattern's version
        expect(check.ok).toBe(!foreign);
        if (!check.ok) expect(check.reason).toMatch(/was recorded against pattern version .* but the pattern is /);
        // re-recorded history at the pattern's version always resolves
        expect(
          resolveReplay(def, history.map((e) => ({ ...e, patternVersion: def.version }))).ok,
        ).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
