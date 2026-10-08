// Purpose: property test for review_separates_judgments (review-does-not-conflate-authority)
// Responsibilities: review patterns keep inspection, evaluation, verification, annotation, rejection, and authorization distinct
// Rationale: contract .espectacular/interaction-patterns/review-does-not-conflate-authority.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { reviewSeparatesJudgments } from "../../src/interaction-patterns/invariants";
import { node, reviewPattern, REGISTRY } from "./fixtures";
import type { PatternNode } from "../../src/interaction-patterns/types";

describe("interaction-patterns properties: review", () => {
  it("TypeScript test: review can verify without authorizing and authorize only through a distinct event", () => {
    // a review pattern that keeps the six judgment kinds on distinct nodes is valid
    expect(reviewSeparatesJudgments(reviewPattern()).ok).toBe(true);
    // collapsing two judgment kinds onto one node is refused — verification
    // and authorization can never share a node
    const collapsed = reviewPattern({
      nodes: [
        node({ id: "verify", primitiveId: "primitive.verify", judgmentKind: "verification" }),
        node({ id: "authorize", primitiveId: "primitive.authorize", judgmentKind: "verification" }),
      ],
    });
    const check = reviewSeparatesJudgments(collapsed);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(
      'review nodes "verify" and "authorize" collapse judgment kind "verification"',
    );
    // a review node without a judgment kind does not know which judgment it carries
    const untyped = reviewPattern({
      nodes: [node({ id: "inspect", primitiveId: "primitive.inspect" }) as PatternNode],
    });
    expect(reviewSeparatesJudgments(untyped).reason).toBe(
      'review node "inspect" does not declare a judgment kind',
    );
    // a judgment kind outside the six declared kinds is refused
    const foreign = reviewPattern({
      nodes: [node({ id: "approve", primitiveId: "primitive.authorize", judgmentKind: "approval" as never })],
    });
    expect(reviewSeparatesJudgments(foreign).reason).toBe(
      'review node "approve" declares unknown judgment kind "approval"',
    );
    // at runtime, verification completes without producing any authorization event
    const m = createPatternMachine(reviewPattern(), REGISTRY);
    m.fire("validate_pattern");
    m.fire("start_pattern");
    m.recordStep("verify");
    expect(m.stepEvents.some((e) => e.judgmentKind === "authorization")).toBe(false);
    // authorization arrives only through the distinct authorization step event
    m.recordStep("authorize");
    expect(m.stepEvents.filter((e) => e.judgmentKind === "authorization")).toHaveLength(1);
  });
});
