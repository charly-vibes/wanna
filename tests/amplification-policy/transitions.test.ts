// Purpose: transition tests for the interaction amplification policy model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with precise failure reasons
// Rationale: guards must fail with exact reason strings; loose regexes let real bypasses through
import { describe, it, expect } from "vitest";
import { createAmplificationPolicy } from "../../src/amplification-policy/machine";
import { candidate, context } from "./fixtures";

describe("amplification-policy transitions", () => {
  it("normalize_context moves received → normalized when the determinism guard holds", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    const r = m.fire("normalize_context");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("normalized");
  });

  it("normalize_context refuses a context that does not pin both versions, naming the missing pin", () => {
    const noCatalog = createAmplificationPolicy(
      context({ catalogVersion: "" }),
      [candidate()],
    );
    const r = noCatalog.fire("normalize_context");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard deterministic_after_normalization fails: context does not pin a catalog version",
    );
    const noPolicy = createAmplificationPolicy(
      context({ policyVersion: "" }),
      [candidate()],
    );
    const r2 = noPolicy.fire("normalize_context");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "guard deterministic_after_normalization fails: context does not pin a policy version",
    );
  });

  it("evaluate_candidates moves normalized → evaluated when the risk-floor guard holds", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    m.fire("normalize_context");
    const r = m.fire("evaluate_candidates");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("evaluated");
  });

  it("evaluate_candidates refuses a candidate that does not declare its assurance level", () => {
    const m = createAmplificationPolicy(context(), [candidate({ id: "leaky", declaredAssurance: undefined })]);
    m.fire("normalize_context");
    const r = m.fire("evaluate_candidates");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard risk_floor_preserved fails: candidate leaky does not declare an assurance level",
    );
    expect(m.state).toBe("normalized");
  });

  it("select_candidate moves evaluated → selected when the least-burden guard holds", () => {
    const m = createAmplificationPolicy(context(), [candidate({ id: "a", declaredHumanEffort: 2 })]);
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("select_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("selected");
    expect(m.decision?.selected).toEqual([
      { id: "a", reasonCode: "selected_least_burden" },
    ]);
  });

  it("select_candidate refuses when every candidate was excluded — there is no eligible candidate to select", () => {
    const m = createAmplificationPolicy(
      context({ riskClass: "high" }),
      [candidate({ id: "weak", declaredAssurance: 0 })],
    );
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("select_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard least_burden_candidate fails: no eligible candidate to select",
    );
    expect(m.state).toBe("evaluated");
  });

  it("return_no_candidate moves evaluated → no_candidate when no human contribution or gate remains", () => {
    const m = createAmplificationPolicy(
      context({ requiresHumanContribution: false }),
      [candidate()],
    );
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("return_no_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("no_candidate");
    expect(m.decision?.outcome).toBe("no_candidate");
  });

  it("return_no_candidate refuses while a human contribution is still required", () => {
    const m = createAmplificationPolicy(
      context({ requiresHumanContribution: true, authorityGates: [], verificationGates: [] }),
      [candidate()],
    );
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("return_no_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard no_interaction_when_not_needed fails: a human contribution is still required",
    );
    expect(m.state).toBe("evaluated");
  });

  it("return_no_candidate refuses while an unresolved authority gate remains, naming the gate", () => {
    const m = createAmplificationPolicy(
      context({ requiresHumanContribution: false, authorityGates: ["deploy-approval"] }),
      [candidate()],
    );
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("return_no_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard no_interaction_when_not_needed fails: an unresolved authority gate remains: deploy-approval",
    );
  });

  it("return_no_candidate refuses while an unresolved verification gate remains, naming the gate", () => {
    const m = createAmplificationPolicy(
      context({ requiresHumanContribution: false, verificationGates: ["proof-check"] }),
      [candidate()],
    );
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    const r = m.fire("return_no_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard no_interaction_when_not_needed fails: an unresolved verification gate remains: proof-check",
    );
  });

  it("reject_stale_context moves evaluated → stale when a different context was proposed", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    m.proposeContext(context({ taskRevision: "task-12" }));
    const r = m.fire("reject_stale_context");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("stale");
  });

  it("reject_stale_context refuses when the normalized context is unchanged since evaluation", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    m.proposeContext(context());
    const r = m.fire("reject_stale_context");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard ¬deterministic_after_normalization fails: normalized context is unchanged since evaluation",
    );
    expect(m.state).toBe("evaluated");
  });

  it("recompute_new_context moves stale → received when the last decision carries reason codes", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    m.proposeContext(context({ taskRevision: "task-12" }));
    m.fire("reject_stale_context");
    const r = m.fire("recompute_new_context");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("received");
  });

  it("recompute_new_context refuses when the last decision record carries no reason-coded entries", () => {
    // evaluating zero candidates records nothing stable — there is no reason-coded
    // result to carry forward into the recompute
    const m = createAmplificationPolicy(context({ requiresHumanContribution: false }), []);
    m.fire("normalize_context");
    m.fire("evaluate_candidates");
    m.proposeContext(context({ requiresHumanContribution: false, taskRevision: "task-12" }));
    m.fire("reject_stale_context");
    const r = m.fire("recompute_new_context");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard decision_reasons_stable fails: last decision record carries no reason-coded selections or exclusions",
    );
    expect(m.state).toBe("stale");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createAmplificationPolicy(context(), [candidate()]);
    // select_candidate starts at evaluated, not received
    const r = m.fire("select_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("transition select_candidate cannot fire from state received");
    expect(m.state).toBe("received");
    // recompute_new_context starts at stale, not received
    const r2 = m.fire("recompute_new_context");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("transition recompute_new_context cannot fire from state received");
  });
});
