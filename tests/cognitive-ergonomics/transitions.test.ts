// Purpose: transition tests for the cognitive-ergonomics model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: the machine must mirror the spec row for row and every refusal must name the exact guard that failed
import { describe, it, expect } from "vitest";
import { createAdaptationMachine } from "../../src/cognitive-ergonomics/machine";
import { adaptation, inferredState, interruption, request } from "./fixtures";

describe("cognitive-ergonomics transitions", () => {
  it("propose_adaptation moves baseline → candidate_adaptation when measurable burden is separated from inference", () => {
    const m = createAdaptationMachine(request());
    const r = m.fire("propose_adaptation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("candidate_adaptation");
  });

  it("propose_adaptation is refused when only inferred human state is offered, naming the exact reason", () => {
    const m = createAdaptationMachine(
      request({ adaptation: adaptation({ measurableTriggers: [], inferredStates: [inferredState()] }) }),
    );
    const r = m.fire("propose_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard measurable_burden_separated_from_inference does not hold: no measurable burden recorded — inferred human state cannot trigger an adaptation alone",
    );
    expect(m.state).toBe("baseline");
  });

  it("propose_adaptation is refused when an inferred state is not labeled uncertain, naming the attribute", () => {
    const m = createAdaptationMachine(
      request({
        adaptation: adaptation({
          inferredStates: [inferredState({ uncertain: false })],
        }),
      }),
    );
    const r = m.fire("propose_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard measurable_burden_separated_from_inference does not hold: inferred state confusion is not labeled uncertain",
    );
  });

  it("admit_stable_adaptation moves candidate_adaptation → eligible when the temporal-stability guard holds", () => {
    const m = createAdaptationMachine(request());
    m.fire("propose_adaptation");
    const r = m.fire("admit_stable_adaptation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("eligible");
  });

  it("admit_stable_adaptation is refused when the adaptation replaces the active surface during entry without safety or acceptance", () => {
    const m = createAdaptationMachine(
      request({ adaptation: adaptation({ replacesSurfaceDuringEntry: true }) }),
    );
    m.fire("propose_adaptation");
    const r = m.fire("admit_stable_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard adaptation_temporally_stable does not hold: the adaptation replaces or reorders the active response surface during entry without a safety requirement or explicit user acceptance",
    );
    expect(m.state).toBe("candidate_adaptation");
  });

  it("block_disruptive_adaptation moves candidate_adaptation → blocked and records why the stability guard fails", () => {
    const m = createAdaptationMachine(
      request({ adaptation: adaptation({ replacesSurfaceDuringEntry: true }) }),
    );
    m.fire("propose_adaptation");
    const r = m.fire("block_disruptive_adaptation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("blocked");
    expect(m.blockReason).toMatch(/adaptation_temporally_stable does not hold/);
  });

  it("block_disruptive_adaptation is refused when the adaptation is already temporally stable", () => {
    const m = createAdaptationMachine(request());
    m.fire("propose_adaptation");
    const r = m.fire("block_disruptive_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "block_disruptive_adaptation requires a disruptive adaptation — adaptation_temporally_stable holds, so nothing is blocked",
    );
    expect(m.state).toBe("candidate_adaptation");
  });

  it("apply_adaptation moves eligible → applied when the adaptation exposes a reason and an override path", () => {
    const m = createAdaptationMachine(request());
    m.fire("propose_adaptation");
    m.fire("admit_stable_adaptation");
    const r = m.fire("apply_adaptation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("applied");
    expect(m.appliedAdaptation?.adaptationId).toBe("adapt-1");
  });

  it("apply_adaptation is refused when the material change exposes no reason, and separately when no override path exists", () => {
    const noReason = createAdaptationMachine(request({ adaptation: adaptation({ reason: undefined }) }));
    noReason.fire("propose_adaptation");
    noReason.fire("admit_stable_adaptation");
    const r1 = noReason.fire("apply_adaptation");
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe(
      "guard adaptation_explainable_and_overridable does not hold: the material adaptation exposes no reason",
    );

    const noOverride = createAdaptationMachine(request({ adaptation: adaptation({ override: undefined }) }));
    noOverride.fire("propose_adaptation");
    noOverride.fire("admit_stable_adaptation");
    const r2 = noOverride.fire("apply_adaptation");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "guard adaptation_explainable_and_overridable does not hold: the adaptation exposes no way to revert, disable, or choose a stable presentation",
    );
  });

  it("defer_interruption moves eligible → deferred when the interruption fails the value test, recording why", () => {
    const m = createAdaptationMachine(request({ interruption: interruption({ urgency: undefined }) }));
    m.fire("propose_adaptation");
    m.fire("admit_stable_adaptation");
    const r = m.fire("defer_interruption");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("deferred");
    expect(m.deferralRecord).toMatch(/interruption value test fails: no recorded urgency/);
  });

  it("defer_interruption is refused when the interruption passes the value test", () => {
    const m = createAdaptationMachine(request({ interruption: interruption() }));
    m.fire("propose_adaptation");
    m.fire("admit_stable_adaptation");
    const r = m.fire("defer_interruption");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "defer_interruption requires an interruption that fails the value test — need, benefit, urgency, and deferral rationale are all recorded",
    );
    expect(m.state).toBe("eligible");
  });

  it("revert_adaptation moves applied → reverted when the revert carries a reason", () => {
    const m = createAdaptationMachine(request({ revertReason: "the grouped chooser hid the frequent target" }));
    m.fire("propose_adaptation");
    m.fire("admit_stable_adaptation");
    m.fire("apply_adaptation");
    const r = m.fire("revert_adaptation");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("reverted");
    expect(m.revertRecord?.adaptationId).toBe("adapt-1");
    expect(m.revertRecord?.reason).toBe("the grouped chooser hid the frequent target");
  });

  it("revert_adaptation is refused when the revert records no reason", () => {
    const m = createAdaptationMachine(request());
    m.fire("propose_adaptation");
    m.fire("admit_stable_adaptation");
    m.fire("apply_adaptation");
    const r = m.fire("revert_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard adaptation_explainable_and_overridable does not hold: the revert records no reason",
    );
    expect(m.state).toBe("applied");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createAdaptationMachine(request());
    // apply_adaptation starts at eligible, not baseline
    const r = m.fire("apply_adaptation");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("apply_adaptation");
    expect(r.reason).toContain("baseline");
    expect(m.state).toBe("baseline");
  });
});
