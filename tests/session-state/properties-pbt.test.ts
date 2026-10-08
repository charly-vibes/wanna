// Purpose: fast-check property-based tests for the session-state layer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/session-state/spec.md);
//   contracts bind via `vitest run tests/session-state/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { createSession } from "../../src/session-state/index";
import { concurrentUpdateDetected, durableIsSerializable } from "../../src/session-state/index";
import type { SessionData } from "../../src/session-state/index";
import { ENV } from "./fixtures";

// plain scalar values: JSON-serializable and free of non-serializable semantics
const scalarArb = fc.oneof(fc.string({ maxLength: 32 }), fc.integer(), fc.boolean(), fc.constant(null));

// object keys from a fixed host-token-free alphabet (the serializable walk scans keys)
const safeKeyArb = fc.constantFrom("note", "alpha", "beta", "gamma", "delta", "epsilon");

const plainSnapshotArb = fc.dictionary(safeKeyArb, scalarArb, { maxKeys: 5 });

describe("session-state properties (fast-check)", () => {
  it("TypeScript conformance test: assert invariant session_serializable at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1e6 }), plainSnapshotArb, (sessionIdSeed, snapshot) => {
        const m = createSession(`session-${sessionIdSeed}`, ENV);
        const r = m.fire("suspend_session", { snapshot });
        // plain data always suspends and serializes to stable, re-readable JSON
        expect(r.ok).toBe(true);
        const first = m.serialize();
        const second = m.serialize();
        expect(second).toBe(first); // serialization is deterministic
        const parsed = JSON.parse(first) as Record<string, unknown>;
        expect(parsed.schemaVersion).toBe("session-state-1");
        expect(parsed.sessionId).toBe(`session-${sessionIdSeed}`);
        expect(durableIsSerializable(parsed).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.nat({ max: 1e6 }), (seed) => {
        // non-serializable durable payloads are rejected before the machine mutates state
        const nonSerializable = fc.sample(
          fc.record({ fn: fc.func(fc.constant("x")), seed: fc.constant(seed) }),
          { numRuns: 1 },
        )[0]!;
        const m = createSession(`session-${seed}`, ENV);
        const r = m.fire("suspend_session", { snapshot: nonSerializable });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/session_serializable does not hold/);
        expect(m.state).toBe("open"); // rejected suspend preserves the prior state
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript conformance test: assert invariant concurrent_updates_detected at its trust boundary and under its stated edge cases.", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), fc.integer({ min: 1, max: 1e6 }), (base, rev) => {
        const session: SessionData = {
          sessionId: "s", revision: rev, pending: {}, completed: [], changed: [],
          unresolved: [], nextAttention: null, closeReason: null,
        };
        const check = concurrentUpdateDetected(base, session);
        // detection fires exactly when the base revision differs from the current revision
        expect(check.ok).toBe(base !== rev);
        if (!check.ok) expect(check.reason).toMatch(/revision precondition satisfied/);
      }),
      { numRuns: 100 },
    );
  });
});
