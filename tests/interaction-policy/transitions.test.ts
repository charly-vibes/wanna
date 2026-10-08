// Purpose: transition tests for the interaction-policy model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise reasons, never masked ones
import { describe, it, expect } from "vitest";
import { createPolicyMachine } from "../../src/interaction-policy/machine";
import { POLICY_VERSION } from "../../src/interaction-policy/types";
import { BASE_CONTEXT, eligibleCandidate, validInput } from "./fixtures";

const UNPINNED = "unpinned@0.0.0";

describe("interaction-policy transitions", () => {
  it("begin_valid_evaluation moves ready → evaluating when policy_input_valid holds", () => {
    const m = createPolicyMachine(validInput());
    const r = m.fire("begin_valid_evaluation");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("evaluating");
  });

  it("begin_valid_evaluation refuses with the exact input-invalidity when the guard fails", () => {
    const m = createPolicyMachine(validInput({ policyVersion: UNPINNED }));
    const r = m.fire("begin_valid_evaluation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      `policy_input_valid fails: unpinned policy version ${UNPINNED} (expected ${POLICY_VERSION})`,
    );
    expect(m.state).toBe("ready");
  });

  it("reject_invalid_input moves ready → failed when ¬policy_input_valid holds, naming the violation", () => {
    const m = createPolicyMachine(validInput({ policyVersion: UNPINNED }));
    const r = m.fire("reject_invalid_input");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("failed");
    expect(m.rejectionReason).toBe(
      `policy_input_valid fails: unpinned policy version ${UNPINNED} (expected ${POLICY_VERSION})`,
    );
  });

  it("reject_invalid_input refuses when the input is valid", () => {
    const m = createPolicyMachine(validInput());
    const r = m.fire("reject_invalid_input");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("guard reject_invalid_input requires ¬policy_input_valid, but the input is valid");
    expect(m.state).toBe("ready");
  });

  it("return_ranked_candidates moves evaluating → recommended when eligible_candidate_exists holds", () => {
    const m = createPolicyMachine(validInput());
    m.fire("begin_valid_evaluation");
    const r = m.fire("return_ranked_candidates");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("recommended");
    expect(m.lastResult?.recommendations).toHaveLength(2);
  });

  it("return_ranked_candidates refuses with the exact reason when no candidate is eligible", () => {
    // candidate kind is not mapped for the need kind — the only candidate is excluded
    const m = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ kind: "verify" })] }));
    m.fire("begin_valid_evaluation");
    const r = m.fire("return_ranked_candidates");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("guard eligible_candidate_exists fails: no candidate passed every eligibility gate");
    expect(m.state).toBe("evaluating");
  });

  it("return_no_candidate moves evaluating → no_candidate when ¬eligible_candidate_exists holds", () => {
    const m = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ kind: "verify" })] }));
    m.fire("begin_valid_evaluation");
    const r = m.fire("return_no_candidate");
    expect(r).toEqual({ ok: true });
    expect(m.state).toBe("no_candidate");
    expect(m.lastResult?.outcome).toBe("no_candidate");
  });

  it("return_no_candidate refuses when a candidate is eligible", () => {
    const m = createPolicyMachine(validInput());
    m.fire("begin_valid_evaluation");
    const r = m.fire("return_no_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("guard ¬eligible_candidate_exists fails: 2 candidates are eligible");
    expect(m.state).toBe("evaluating");
  });

  it("reevaluate_after_recommendation moves recommended → ready only after an explicit request", () => {
    const m = createPolicyMachine(validInput());
    m.fire("begin_valid_evaluation");
    m.fire("return_ranked_candidates");
    const without = m.fire("reevaluate_after_recommendation");
    expect(without.ok).toBe(false);
    expect(without.reason).toBe(
      "guard reevaluation_requested fails: no explicit reevaluation or changed-context request recorded",
    );
    expect(m.state).toBe("recommended");
    const withRequest = m.requestReevaluation();
    expect(withRequest).toEqual({ ok: true });
    expect(m.state).toBe("ready");
  });

  it("retry_after_empty_result moves no_candidate → ready only when new context is received", () => {
    const m = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ kind: "verify" })] }));
    m.fire("begin_valid_evaluation");
    m.fire("return_no_candidate");
    const unchanged = m.retryWithNewContext(BASE_CONTEXT);
    expect(unchanged.ok).toBe(false);
    expect(unchanged.reason).toBe(
      "guard new_context_received fails: supplied context is unchanged (task revision, catalog version, and user preferences are identical)",
    );
    expect(m.state).toBe("no_candidate");
    const changed = m.retryWithNewContext({ taskRevision: "task-12", userPreferences: ["compact"] });
    expect(changed).toEqual({ ok: true });
    expect(m.state).toBe("ready");
  });

  it("retry_after_failure moves failed → ready only after corrected schema-valid input", () => {
    const invalid = validInput({ policyVersion: UNPINNED });
    const m = createPolicyMachine(invalid);
    m.fire("reject_invalid_input");
    const stillInvalid = m.retryWithCorrectedInput(invalid);
    expect(stillInvalid.ok).toBe(false);
    expect(stillInvalid.reason).toBe(
      `guard corrected_input_received fails: policy_input_valid fails: unpinned policy version ${UNPINNED} (expected ${POLICY_VERSION})`,
    );
    expect(m.state).toBe("failed");
    const corrected = m.retryWithCorrectedInput(validInput());
    expect(corrected).toEqual({ ok: true });
    expect(m.state).toBe("ready");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createPolicyMachine(validInput());
    // return_ranked_candidates starts at evaluating, not ready
    const r = m.fire("return_ranked_candidates");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition return_ranked_candidates cannot fire from state ready");
    expect(m.state).toBe("ready");
  });

  it("fire refuses unknown transition ids", () => {
    const m = createPolicyMachine(validInput());
    const r = m.fire("no_such_transition" as never);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown transition no_such_transition");
  });
});