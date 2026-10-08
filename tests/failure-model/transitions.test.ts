// Purpose: transition tests for the failure model
// Responsibilities: every [[openspec/specs/failure-model]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: the machine mirrors the spec row for row; guards fail with exact reasons so bypasses cannot hide behind vague refusals
import { describe, it, expect } from "vitest";
import { createFailureModel } from "../../src/failure-model/machine";
import { assessment, typedFailureRecord } from "./fixtures";

describe("failure-model transitions", () => {
  it("contain_failure moves detected → contained when failure_is_typed holds", () => {
    const m = createFailureModel(typedFailureRecord());
    const r = m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("contained");
    expect(m.applied).toEqual([{ id: "contain_failure", from: "detected", to: "contained" }]);
  });

  it("contain_failure refuses an untyped record, naming failure_is_typed and the missing field", () => {
    const m = createFailureModel(typedFailureRecord({ scope: undefined as never }));
    const r = m.fire("contain_failure", {
      kind: "record",
      record: typedFailureRecord({ scope: undefined as never }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("failure_is_typed");
    expect(r.reason).toContain("scope");
    expect(m.state).toBe("detected");
  });

  it("assess_failure moves contained → assessing when effect_certainty_explicit holds", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    const r = m.fire("assess_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "partial_effect" }),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("assessing");
  });

  it("assess_failure refuses a lost-acknowledgement timeout classified no_effect before reconciliation", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    const r = m.fire("assess_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "effect_certainty_explicit does not hold: timeout or transport failure alone cannot imply no_effect — the effect is effect_unknown until reconciliation supplies evidence",
    );
    expect(m.state).toBe("contained");
  });

  it("classify_known_failure moves assessing → known when the effect certainty is known", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    const r = m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "effect_applied" }),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("known");
  });

  it("classify_known_failure refuses an unknown outcome, naming the constraint", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    const r = m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "effect_unknown" }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "effect_certainty_explicit does not hold: an unknown outcome cannot be classified as a known failure",
    );
    expect(m.state).toBe("assessing");
  });

  it("classify_uncertain_failure moves assessing → uncertain for effect_unknown", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    const r = m.fire("classify_uncertain_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "effect_unknown" }),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("uncertain");
  });

  it("classify_uncertain_failure refuses a known effect certainty", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    const r = m.fire("classify_uncertain_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "effect_certainty_explicit does not hold: effect certainty no_effect is known — classification belongs on the known path",
    );
    expect(m.state).toBe("assessing");
  });

  it("resolve_known_failure moves known → resolved when recoverability_explicit holds", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    const r = m.fire("resolve_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect", recoverability: "compensatable" }),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("resolved");
  });

  it("resolve_known_failure refuses an unclassified recovery", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    const r = m.fire("resolve_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect", recoverability: undefined as never }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("recoverability_explicit");
    expect(m.state).toBe("known");
  });

  it("escalate_uncertain_failure moves uncertain → escalated when retry is not proven idempotent", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    m.fire("classify_uncertain_failure", { kind: "assessment", assessment: assessment() });
    const r = m.fire("escalate_uncertain_failure");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("escalated");
  });

  it("escalate_uncertain_failure refuses escalation when retry_safety_explicit holds", () => {
    const m = createFailureModel(typedFailureRecord());
    m.fire("contain_failure", { kind: "record", record: typedFailureRecord() });
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    // proven_idempotent makes the retry path safe — escalation is refused
    const safe = assessment({ retrySafety: "proven_idempotent" });
    m.fire("classify_uncertain_failure", { kind: "assessment", assessment: safe });
    const r = m.fire("escalate_uncertain_failure");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "escalate_uncertain_failure guard does not hold: retry_safety_explicit holds — retry is proven idempotent; resolve through the retry path instead of escalating",
    );
    expect(m.state).toBe("uncertain");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createFailureModel(typedFailureRecord());
    // escalate_uncertain_failure starts at uncertain, not detected
    const r = m.fire("escalate_uncertain_failure");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("escalate_uncertain_failure");
    expect(r.reason).toContain("detected");
    expect(m.state).toBe("detected");
  });
});
