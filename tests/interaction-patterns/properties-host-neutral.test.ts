// Purpose: property test for pattern_state_host_neutral (p-pattern-state-host-neutral)
// Responsibilities: pattern definitions and instance records carry no DOM, Pi, TUI, component-library, or layout state
// Rationale: contract .espectacular/interaction-patterns/p-pattern-state-host-neutral.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { patternStateHostNeutral, PATTERNS_PRESENTATION_VOCABULARY } from "../../src/interaction-patterns/invariants";
import { degradedPattern, genericPattern, REGISTRY } from "./fixtures";

describe("interaction-patterns properties: host neutrality", () => {
  it("pattern progression is independent of DOM, Pi, TUI, component-library, and layout state", () => {
    // a canonical definition is host-free
    expect(patternStateHostNeutral(genericPattern()).ok).toBe(true);
    // a definition embedding presentation vocabulary names the leaked tokens
    const leak = patternStateHostNeutral(
      genericPattern({ summary: "renders a modal dialog component in a flexbox layout" }),
    );
    expect(leak.ok).toBe(false);
    expect(leak.reason).toBe(
      "pattern definition carries host or presentation state: modal, component, flexbox, layout",
    );
    // a full run's instance records — history, step events, and outcome records — stay host-free
    const m = createPatternMachine(genericPattern(), REGISTRY);
    m.fire("validate_pattern");
    m.fire("start_pattern");
    m.recordStep("n1");
    m.fire("wait_for_contribution", "n2");
    m.revise(degradedPattern());
    m.fire("fail_pattern", "upstream dependency vanished");
    const serialized = JSON.stringify({
      state: m.state,
      history: m.history,
      stepEvents: m.stepEvents,
      awaitingRecord: m.awaitingRecord,
      failureRecord: m.failureRecord,
    }).toLowerCase();
    for (const token of PATTERNS_PRESENTATION_VOCABULARY) {
      expect(serialized).not.toContain(token);
    }
  });
});
