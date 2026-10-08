// Purpose: conformance property tests for the privacy_minimized invariant
// Responsibilities: assert the invariant at its trust boundary and under its stated edge cases
// Rationale: contract .espectacular/evaluation-telemetry/privacy-minimized-holds.toml binds via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { privacyMinimized } from "../../src/evaluation-telemetry/invariants";
import { failureOf, validCollection } from "./fixtures";

describe("evaluation-telemetry properties", () => {
  it("TypeScript conformance test: assert invariant privacy_minimized at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the collection configuration entering the evaluation layer
    expect(privacyMinimized(validCollection()).ok).toBe(true);
    // purpose limitation
    const noPurpose = privacyMinimized(validCollection({ purpose: "" }));
    expect(noPurpose.ok).toBe(false);
    expect(failureOf(noPurpose)).toBe(
      "guard privacy_minimized does not hold: telemetry collection does not declare a collection purpose",
    );
    // data minimization: raw-content fields beyond the declared purpose are refused
    const raw = privacyMinimized(validCollection({ collectedFields: ["interaction_id", "raw_transcript"] }));
    expect(raw.ok).toBe(false);
    expect(failureOf(raw)).toBe(
      "guard privacy_minimized does not hold: telemetry collection collects raw-content fields beyond the declared purpose: raw_transcript",
    );
    // access controls
    const open = privacyMinimized(validCollection({ accessControls: [] }));
    expect(open.ok).toBe(false);
    expect(failureOf(open)).toBe(
      "guard privacy_minimized does not hold: telemetry collection does not declare access controls",
    );
    // configured retention
    const unbounded = privacyMinimized(validCollection({ retentionDays: 0 }));
    expect(unbounded.ok).toBe(false);
    expect(failureOf(unbounded)).toBe(
      "guard privacy_minimized does not hold: telemetry collection does not declare configured retention",
    );
  });
});