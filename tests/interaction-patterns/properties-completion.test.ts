// Purpose: property test for pattern_completion_explicit (p-pattern-completion-explicit)
// Responsibilities: a pattern declares the completion conditions applicable to it, with precise refusals
// Rationale: contract .espectacular/interaction-patterns/p-pattern-completion-explicit.toml binds via `vitest -t`
import { describe, it, expect } from "vitest";
import { createPatternMachine } from "../../src/interaction-patterns/machine";
import { patternCompletionExplicit } from "../../src/interaction-patterns/invariants";
import { genericPattern, REGISTRY } from "./fixtures";

describe("interaction-patterns properties: completion", () => {
  it("a pattern declares success, rejection, cancellation, deferral, failure, and unresolved completion conditions where applicable", () => {
    // success is applicable to every pattern; failure is declared where the
    // pattern can fail (see pattern_failure_recorded) and travels with the
    // canonical fixtures
    expect(patternCompletionExplicit(genericPattern()).ok).toBe(true);
    // dropping success leaves completion implicit
    const noSuccess = patternCompletionExplicit(genericPattern({ conditions: ["failure"] }));
    expect(noSuccess.ok).toBe(false);
    expect(noSuccess.reason).toBe("missing completion conditions: success");
    // a cancellable pattern must declare its cancellation condition
    const cancellable = patternCompletionExplicit(
      genericPattern({ cancellable: true, conditions: ["success", "failure", "unresolved"] }),
    );
    expect(cancellable.ok).toBe(false);
    expect(cancellable.reason).toBe("missing completion conditions: cancellation");
    // declaring it where applicable restores explicitness
    expect(
      patternCompletionExplicit(
        genericPattern({ cancellable: true, conditions: ["success", "failure", "cancellation"] }),
      ).ok,
    ).toBe(true);
    // rejection and deferral apply only when the pattern supports those paths
    const rejecting = patternCompletionExplicit(
      genericPattern({ supportsRejection: true, conditions: ["success", "failure"] }),
    );
    expect(rejecting.ok).toBe(false);
    expect(rejecting.reason).toBe("missing completion conditions: rejection");
    const deferring = patternCompletionExplicit(
      genericPattern({ supportsDeferral: true, conditions: ["success", "failure"] }),
    );
    expect(deferring.ok).toBe(false);
    expect(deferring.reason).toBe("missing completion conditions: deferral");
    // the machine's start transition carries the same refusal, naming every missing condition
    const m = createPatternMachine(
      genericPattern({ supportsRejection: true, supportsDeferral: true, conditions: [] }),
      REGISTRY,
    );
    m.fire("validate_pattern");
    const r = m.fire("start_pattern");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "start_pattern guard pattern_completion_explicit does not hold: missing completion conditions: success, rejection, deferral",
    );
  });
});
