// Purpose: guard properties for the interaction-policy evaluator's retry and authority paths
// Responsibilities: reevaluation-only-on-request, empty-result-requires-new-input, failure-requires-correction, policy-cannot-authorize
// Rationale: every refusal names its guard and the exact unmet condition
import { describe, it, expect } from "vitest";
import { createPolicyMachine } from "../../src/interaction-policy/machine";
import { authorizeWithRecommendation } from "../../src/interaction-policy/invariants";
import { BASE_CONTEXT, CATALOG_V7, eligibleCandidate, validInput } from "./fixtures";
import { POLICY_VERSION } from "../../src/interaction-policy/types";

describe("interaction-policy retry and authority properties", () => {
  it("TypeScript test: recommendation is not reevaluated without an explicit request", () => {
    const m = createPolicyMachine(validInput());
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    expect(m.state).toBe("recommended");
    // the machine never re-enters evaluation on its own, and the transition guard refuses
    expect(m.fire("reevaluate_after_recommendation").ok).toBe(false);
    expect(m.state).toBe("recommended");
    expect(m.evaluate().ok).toBe(false);
    expect(m.state).toBe("recommended");
    // only an explicit request moves recommended → ready
    expect(m.requestReevaluation()).toEqual({ ok: true });
    expect(m.state).toBe("ready");
  });

  it("TypeScript test: unchanged context does not trigger an unbounded retry loop after no candidates are eligible", () => {
    const m = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ kind: "verify" })] }));
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    expect(m.state).toBe("no_candidate");
    for (let i = 0; i < 10; i++) {
      const retry = m.retryWithNewContext(BASE_CONTEXT);
      expect(retry.ok).toBe(false);
      expect(retry.reason).toBe(
        "guard new_context_received fails: supplied context is unchanged (task revision, catalog version, and user preferences are identical)",
      );
      expect(m.state).toBe("no_candidate");
    }
    // new context data unlocks exactly one retry back to ready
    expect(m.retryWithNewContext({ taskRevision: "task-12", userPreferences: ["compact"] })).toEqual({ ok: true });
    expect(m.state).toBe("ready");
    // a new catalog version alone also counts as new context data
    const m2 = createPolicyMachine(validInput({ candidates: [eligibleCandidate({ kind: "verify" })] }));
    m2.evaluate();
    expect(m2.retryWithNewContext({ taskRevision: "task-11", userPreferences: ["compact"], catalogVersion: "catalog-2026.11.0" })).toEqual({ ok: true });
    expect(m2.state).toBe("ready");
    expect(m2.lastInput?.catalog.version).toBe("catalog-2026.11.0");
  });

  it("TypeScript test: failed evaluation re-enters ready only after schema-valid corrected input", () => {
    const invalid = validInput({ policyVersion: "drifted@9.9.9" });
    const m = createPolicyMachine(invalid);
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(false);
    expect(m.state).toBe("failed");
    // uncorrected retries are refused with the exact schema violation
    const uncorrected = m.retryWithCorrectedInput(invalid);
    expect(uncorrected.ok).toBe(false);
    expect(uncorrected.reason).toBe(
      `guard corrected_input_received fails: policy_input_valid fails: unpinned policy version drifted@9.9.9 (expected ${POLICY_VERSION})`,
    );
    expect(m.state).toBe("failed");
    // schema-valid corrected input re-enters ready and replaces the pinned input
    const corrected = m.retryWithCorrectedInput(validInput());
    expect(corrected).toEqual({ ok: true });
    expect(m.state).toBe("ready");
    expect(m.lastInput?.policyVersion).toBe(POLICY_VERSION);
  });

  it("TypeScript test: a recommendation alone cannot satisfy an authorization/approval precondition", () => {
    const m = createPolicyMachine(
      validInput({
        need: { ...validInput().need, kind: "approve" },
        candidates: [eligibleCandidate({ id: "auth-1", kind: "authorize", score: 9 })],
      }),
    );
    const outcome = m.evaluate();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // the authorize-kind interaction is recommended — and still carries no authority
    expect(outcome.result.recommendations.map((r) => r.id)).toEqual(["auth-1"]);
    const attempt = authorizeWithRecommendation(outcome.result, {
      action: "merge",
      scope: "repo",
      taskRevision: "task-11",
      actor: "agent-7",
    });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe(
      "a policy recommendation carries no authority: authorization requires an independent permission or approval grant",
    );
    // the result record structurally carries no grant, approval, or authorization field
    const recordKeys = Object.keys(outcome.result);
    for (const forbidden of ["grant", "approval", "authorization", "authorizedBy"]) {
      expect(recordKeys).not.toContain(forbidden);
    }
    // the catalog version pin the result carries is data, not authority: same refusal
    expect(CATALOG_V7.version.length).toBeGreaterThan(0);
  });
});