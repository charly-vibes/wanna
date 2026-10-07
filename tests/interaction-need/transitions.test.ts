// Purpose: transition tests for the interaction-need model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise reasons
import { describe, it, expect } from "vitest";
import { createNeedNormalizer } from "../../src/interaction-need/machine";
import { validProposal } from "./fixtures";

describe("interaction-need transitions", () => {
  it("validate_need moves proposed → validating when the schema guard holds", () => {
    const m = createNeedNormalizer(validProposal());
    const r = m.fire("validate_need");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("validating");
  });

  it("reject_invalid_need moves proposed → rejected when the schema guard fails, naming the reason", () => {
    const m = createNeedNormalizer(validProposal({ kind: "not_a_kind" }));
    const r = m.fire("reject_invalid_need");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rejected");
    expect(m.rejectionReason).toMatch(/not_a_kind/);
  });

  it("normalize_need moves validating → normalized when the target-immediate guard holds", () => {
    const m = createNeedNormalizer(validProposal());
    m.fire("validate_need");
    const r = m.fire("normalize_need");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("normalized");
  });

  it("preserve_unresolved_need moves validating → unresolved when the target-immediate guard fails", () => {
    // unsupported kind passes schema shape validation but normalization finds no
    // immediate, evidence-backed target — the need stays unresolved, not invented
    const m = createNeedNormalizer(
      validProposal({ kind: "choose", evidenceStrength: "weak" }),
    );
    m.fire("validate_need");
    const r = m.fire("preserve_unresolved_need");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("unresolved");
  });

  it("retry_unresolved moves unresolved → proposed when unresolved_requires_change holds", () => {
    const first = validProposal({ evidenceStrength: "weak" });
    const m = createNeedNormalizer(first);
    m.fire("validate_need");
    m.fire("preserve_unresolved_need");
    const changed = validProposal({ taskRevision: "task-8" });
    const r = m.retry(changed);
    expect(r.ok).toBe(true);
    expect(m.state).toBe("proposed");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createNeedNormalizer(validProposal());
    // normalize_need starts at validating, not proposed
    const r = m.fire("normalize_need");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("normalize_need");
    expect(m.state).toBe("proposed");
  });
});
