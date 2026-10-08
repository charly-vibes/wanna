// Purpose: fast-check property-based tests for the process-model invariants
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/process-model/spec.md);
//   contracts bind via `vitest run tests/process-model/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { dependenciesAcyclicOrDeclared, waitsCorrelated } from "../../src/process-model/index";
import type { BoundedLoop, DependencyGraph, ProcessDefinition } from "../../src/process-model/index";
import { validDefinition } from "./fixtures";

/** Edges only run from a lower index to a higher one, so every generated graph is a DAG by construction.
 * The full forward chain n0->...->n7 is always present, so a back edge n7->n0 closes a guaranteed cycle. */
const dagGraphArb: fc.Arbitrary<DependencyGraph> = fc
  .array(fc.tuple(fc.nat({ max: 7 }), fc.nat({ max: 7 })), { maxLength: 10 })
  .map((pairs) => ({
    nodes: Array.from({ length: 8 }, (_, i) => `n${i}`),
    edges: [
      ...Array.from({ length: 7 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
      ...pairs.filter(([a, b]) => a < b).map(([a, b]) => ({ from: `n${a}`, to: `n${b}` })),
    ],
  }));

const loopArb = fc.option(
  fc.record({
    terminationCondition: fc.string({ minLength: 0, maxLength: 8 }),
    maxIterations: fc.integer({ min: -2, max: 50 }),
  }),
  { nil: undefined },
);

function definitionAt(graph: DependencyGraph, loop: BoundedLoop | null): ProcessDefinition {
  return validDefinition({ dependencies: graph, boundedLoop: loop });
}

/** A back edge from the highest node to the lowest turns any DAG into a cyclic graph. */
function cyclicOf(graph: DependencyGraph): DependencyGraph {
  return { nodes: graph.nodes, edges: [...graph.edges, { from: "n7", to: "n0" }] };
}

function boundedLoopAccepts(loop: BoundedLoop | undefined): boolean {
  return loop !== undefined && loop.terminationCondition.length > 0 && loop.maxIterations > 0;
}

describe("process-model properties (fast-check)", () => {
  it("TypeScript conformance test: assert invariant dependencies_acyclic_or_declared at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(dagGraphArb, loopArb, (graph, loop) => {
        // acyclic dependency graphs satisfy the invariant whatever the loop declaration
        expect(dependenciesAcyclicOrDeclared(definitionAt(graph, loop ?? null)).ok).toBe(true);
        // a cycle is acceptable only under a bounded loop declaring termination and a positive limit
        const cyclic = dependenciesAcyclicOrDeclared(definitionAt(cyclicOf(graph), loop ?? null));
        expect(cyclic.ok).toBe(boundedLoopAccepts(loop));
        if (!cyclic.ok && loop === undefined) {
          expect(cyclic.reason).toMatch(/no bounded loop construct/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript conformance test: assert invariant waits_correlated at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z-]{1,8}$/), { maxLength: 5 }), (resumeEvents) => {
        const check = waitsCorrelated(validDefinition({ resumeEvents }));
        expect(check.ok).toBe(resumeEvents.length > 0);
        if (!check.ok) expect(check.reason).toBe("process declares no correlated resume events");
      }),
      { numRuns: 100 },
    );
  });
});
