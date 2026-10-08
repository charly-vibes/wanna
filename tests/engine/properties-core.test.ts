// Purpose: conformance tests for interaction-engine domain properties
// Responsibilities: 8 runtime invariants incl. deterministic evaluation and provenance
// Rationale: derives_from [[spec]] — each describe named after its property id
import { describe, it, expect } from "vitest";
import { evaluate, canonicalContextKey } from "../../src/engine/index";
import { makeContext, makePolicy } from "./fixtures";

describe("context_validation_rejects_malformed", () => {
  it("rejects a context missing a required field", () => {
    const malformed = makeContext({ taskRevision: undefined as unknown as number });
    expect(evaluate(malformed, makePolicy()).ok).toBe(false);
  });
  it("rejects an empty need", () => {
    expect(evaluate(makeContext({ need: "  " }), makePolicy()).ok).toBe(false);
  });
});

describe("evaluation_versions_are_pinned", () => {
  it("result carries exactly the policy and catalog versions used", () => {
    const r = evaluate(makeContext(), makePolicy({ version: "pol-9" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.policyVersion).toBe("pol-9");
      expect(r.value.catalogVersion).toBe("cat-2026.10.1");
    }
  });
});

describe("identical_inputs_are_deterministic", () => {
  it("repeated evaluation returns deeply equal ordered results", () => {
    const ctx = makeContext();
    const pol = makePolicy();
    const a = evaluate(ctx, pol);
    const b = evaluate(ctx, pol);
    expect(a).toEqual(b);
    if (a.ok && b.ok) expect(a.value.candidates.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
  it("canonical key is stable for equal contexts", () => {
    expect(canonicalContextKey(makeContext())).toBe(canonicalContextKey(makeContext()));
    expect(canonicalContextKey(makeContext())).not.toBe(canonicalContextKey(makeContext({ taskRevision: 4 })));
  });
});

describe("decision_has_provenance", () => {
  it("records need, revision, versions, ordered candidates, exclusions, reason codes", () => {
    const pol = makePolicy({ candidates: [{ id: "ok", priority: 1 }, { id: "bad", priority: 0 }] });
    const r = evaluate(makeContext(), pol);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.need).toBe("open the file panel");
      expect(r.value.taskRevision).toBe(3);
      expect(r.value.candidates.map((c) => c.id)).toEqual(["ok"]);
      expect(r.value.exclusions).toContainEqual({ id: "bad", reasonCode: "priority_not_positive" });
    }
  });
});

describe("rejection_preserves_state", () => {
  it("rejected evaluations never produce a decision", () => {
    const r = evaluate(makeContext({ taskId: "" }), makePolicy());
    expect(r.ok).toBe(false);
  });
});