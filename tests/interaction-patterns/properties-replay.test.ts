// Purpose: property test for pattern_versioned (pattern-replay-is-versioned)
// Responsibilities: historical pattern events resolve against the recorded pattern version
// Rationale: contract .espectacular/interaction-patterns/pattern-replay-is-versioned.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { resolveReplay } from "../../src/interaction-patterns/invariants";
import { genericPattern, REGISTRY } from "./fixtures";

describe("interaction-patterns properties: replay", () => {
  it("Replay test: historical pattern events resolve against the recorded pattern version", () => {
    const m = createPatternMachine(genericPattern(), REGISTRY);
    m.fire("validate_pattern");
    m.fire("start_pattern");
    // every historical event carries the pattern version it was recorded under
    for (const event of m.history) {
      expect(event.patternVersion).toBe("1.0.0");
    }
    // the history resolves against the definition version it was recorded under
    expect(resolveReplay(genericPattern(), m.history).ok).toBe(true);
    // events recorded under 1.0.0 do NOT resolve against a 2.0.0 definition
    const drifted = resolveReplay(genericPattern({ version: "2.0.0" }), m.history);
    expect(drifted.ok).toBe(false);
    expect(drifted.reason).toBe(
      "event 1 (validate_pattern) was recorded against pattern version 1.0.0 but the pattern is 2.0.0",
    );
    // a definition without an explicit version cannot anchor replay at all
    const unversioned = resolveReplay(genericPattern({ version: "" }), m.history);
    expect(unversioned.ok).toBe(false);
    expect(unversioned.reason).toBe("pattern definitions carry explicit versions used in replay and audit");
    // a mid-run revision is recorded in the history with both versions for audit
    m.revise(genericPattern({ version: "1.1.0" }));
    const revision = m.history.at(-1);
    expect(revision?.id).toBe("revise_pattern");
    expect(revision?.patternVersion).toBe("1.1.0");
    // the pre-revision events still resolve against the version they were recorded under
    expect(resolveReplay(genericPattern(), m.history.slice(0, 2)).ok).toBe(true);
  });
});
