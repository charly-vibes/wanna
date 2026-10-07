// Purpose: smoke-proof that the TS test runner executes at all
// Responsibilities: one trivially true assertion; fails if the runner is broken
// Rationale: tracer-bullet phase 1 (wanna-79h) — red state before vitest wiring
import { describe, it, expect } from "vitest";

describe("runner smoke", () => {
  it("executes a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
