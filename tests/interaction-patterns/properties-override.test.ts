// Purpose: property test for pattern_does_not_override_primitive (p-pattern-does-not-override-primitive)
// Responsibilities: a pattern references primitive semantics; it never redefines response, validation, authority, or escape semantics
// Rationale: contract .espectacular/interaction-patterns/p-pattern-does-not-override-primitive.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { patternDoesNotOverridePrimitive } from "../../src/interaction-patterns/invariants";
import { genericPattern, node } from "./fixtures";
import type { PatternNode } from "../../src/interaction-patterns/types";

describe("interaction-patterns properties: primitive override", () => {
  it("a pattern cannot change the response semantics, validation, authority meaning, or escape semantics of a referenced primitive", () => {
    // a pattern that only references primitives holds the invariant
    expect(patternDoesNotOverridePrimitive(genericPattern()).ok).toBe(true);
    // each override vector is refused, naming the node, the primitive, and the overridden field
    const vectors: readonly [keyof OverrideShape, string][] = [
      ["responseSemantics", "responseSemantics"],
      ["validationOverride", "validationOverride"],
      ["authorityMeaning", "authorityMeaning"],
      ["escapeSemantics", "escapeSemantics"],
    ];
    for (const [key, field] of vectors) {
      const rogueNode = node({ id: "n1" }) as PatternNode & Record<string, unknown>;
      rogueNode[key] = `redefined ${field}`;
      const def = genericPattern({ nodes: [rogueNode] });
      const check = patternDoesNotOverridePrimitive(def);
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(
        `node "n1" overrides primitive "primitive.deliver" ${field} — a pattern references primitive semantics, it does not redefine them`,
      );
    }
  });
});

type OverrideShape = {
  responseSemantics: unknown;
  validationOverride: unknown;
  authorityMeaning: unknown;
  escapeSemantics: unknown;
};
