// Purpose: property test for patterns_compose_primitives (every-pattern-step-is-semantic)
// Responsibilities: each human-contribution node references a registered primitive and the edges connect declared nodes
// Rationale: contract .espectacular/interaction-patterns/every-pattern-step-is-semantic.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { patternComposesPrimitives } from "../../src/interaction-patterns/invariants";
import { genericPattern, REGISTRY } from "./fixtures";

describe("interaction-patterns properties: composition", () => {
  it("Graph test: each human-contribution node references a registered primitive", () => {
    // a well-formed composition holds
    expect(patternComposesPrimitives(genericPattern(), REGISTRY).ok).toBe(true);
    // an unregistered primitive is named precisely
    const unregistered = patternComposesPrimitives(
      genericPattern({ nodes: [{ id: "n1", primitiveId: "primitive.unknown", primitiveVersion: "1.0.0" }] }),
      REGISTRY,
    );
    expect(unregistered.ok).toBe(false);
    expect(unregistered.reason).toBe('node "n1" references unregistered primitive "primitive.unknown"');
    // a node without an explicit primitive version fails the versioned mapping
    const unversioned = patternComposesPrimitives(
      genericPattern({ nodes: [{ id: "n1", primitiveId: "primitive.deliver", primitiveVersion: "" }] }),
      REGISTRY,
    );
    expect(unversioned.ok).toBe(false);
    expect(unversioned.reason).toBe('node "n1" does not declare a primitive version');
    // a composition without process edges is not a composition
    const edgeless = patternComposesPrimitives(genericPattern({ edges: [] }), REGISTRY);
    expect(edgeless.ok).toBe(false);
    expect(edgeless.reason).toBe("no process edges connect the composed primitives");
    // an edge naming an undeclared endpoint fails
    const dangling = patternComposesPrimitives(
      genericPattern({ edges: [{ from: "n1", to: "ghost" }] }),
      REGISTRY,
    );
    expect(dangling.ok).toBe(false);
    expect(dangling.reason).toBe('edge endpoint "ghost" is not a declared contribution node');
    // the machine's validate transition carries the same refusal
    const m = createPatternMachine(genericPattern({ edges: [] }), REGISTRY);
    const r = m.fire("validate_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "validate_pattern guard patterns_compose_primitives does not hold: no process edges connect the composed primitives",
    );
  });
});
