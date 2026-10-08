// Purpose: property test for clarification_reduces_unresolved_state (clarification-has-information-gain-target)
// Responsibilities: a clarification step is eligible only when it names the unresolved target it reduces
// Rationale: contract .espectacular/interaction-patterns/clarification-has-information-gain-target.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { clarificationHasTarget } from "../../src/interaction-patterns/invariants";
import { clarificationPattern, node } from "./fixtures";

describe("interaction-patterns properties: clarification", () => {
  it("Policy test: clarification without a named unresolved target is ineligible", () => {
    // a clarification step naming the ambiguity it reduces is eligible
    expect(clarificationHasTarget(clarificationPattern()).ok).toBe(true);
    // a clarification step with no named unresolved target asks for no information gain
    const targetless = clarificationPattern({
      nodes: [
        node({ id: "ask", primitiveId: "primitive.clarify", unresolvedTarget: undefined }),
        node({ id: "apply", primitiveId: "primitive.deliver" }),
      ],
    });
    const check = clarificationHasTarget(targetless);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('clarification step "ask" names no unresolved target — ineligible');
    // an empty target name is no name
    const empty = clarificationPattern({
      nodes: [
        node({ id: "ask", primitiveId: "primitive.clarify", unresolvedTarget: "" }),
        node({ id: "apply", primitiveId: "primitive.deliver" }),
      ],
    });
    expect(clarificationHasTarget(empty).reason).toBe(
      'clarification step "ask" names no unresolved target — ineligible',
    );
    // the named target must be the ambiguity, missing fact, conflict, or decision the response reduces
    const named = clarificationHasTarget(
      clarificationPattern({
        nodes: [
          node({ id: "ask", primitiveId: "primitive.clarify", unresolvedTarget: "which conflict resolution the user prefers" }),
          node({ id: "apply", primitiveId: "primitive.deliver" }),
        ],
      }),
    );
    expect(named.ok).toBe(true);
  });
});
