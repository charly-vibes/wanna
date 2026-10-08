// Purpose: property tests for the cognitive-ergonomics layer
// Responsibilities: each corpus property as a vitest test; names match the contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/cognitive-ergonomics/*.toml to these tests via `vitest run -t '<description>'`
import { describe, it, expect } from "vitest";
import {
  adaptationExplainableAndOverridable,
  adaptationTemporallyStable,
  authorityGuardSatisfied,
  choiceComplexityBounded,
  interruptionHasValueTest,
  measurableBurdenSeparated,
  renderConfidence,
  recognitionPreferred,
  stableActionIdentityHolds,
} from "../../src/cognitive-ergonomics/invariants";
import { createAdaptationMachine } from "../../src/cognitive-ergonomics/machine";
import {
  actionIdentity,
  adaptation,
  confidenceSource,
  inferredState,
  interruption,
  optionSet,
  presentation,
  request,
} from "./fixtures";

describe("cognitive-ergonomics properties", () => {
  it("Interaction test: non-safety adaptation cannot replace or reorder the active response surface during entry", () => {
    // a non-disruptive adaptation is stable
    expect(adaptationTemporallyStable(adaptation()).ok).toBe(true);
    // replacing the active surface during entry without safety or acceptance is refused,
    // and the same condition blocks the adaptation in the machine
    const disruptive = adaptation({ replacesSurfaceDuringEntry: true });
    const check = adaptationTemporallyStable(disruptive);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/adaptation_temporally_stable does not hold/);
    const m = createAdaptationMachine(request({ adaptation: disruptive }));
    m.fire("propose_adaptation");
    expect(m.fire("admit_stable_adaptation").ok).toBe(false);
    expect(m.fire("block_disruptive_adaptation").ok).toBe(true);
    // a safety-required replacement, or one the user explicitly accepted, is allowed
    expect(adaptationTemporallyStable(adaptation({ replacesSurfaceDuringEntry: true, safetyRequired: true })).ok).toBe(true);
    expect(adaptationTemporallyStable(adaptation({ replacesSurfaceDuringEntry: true, userAccepted: true })).ok).toBe(true);
  });

  it("Policy test: inferred human state never satisfies an authority guard", () => {
    // inferred attributes are refused directly, whatever their estimate
    for (const attribute of ["confusion", "fatigue", "expertise", "cognitive_burden"]) {
      const r = authorityGuardSatisfied({ kind: "inferred", attribute });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(
        `inferred human state ${attribute} cannot satisfy an authority guard — authority requires a measurable fact`,
      );
    }
    // a measurable fact satisfies the guard
    expect(authorityGuardSatisfied({ kind: "measurable", metric: "choice_count" }).ok).toBe(true);
    // through the machine: an inferred-only proposal cannot even be proposed
    const m = createAdaptationMachine(
      request({
        adaptation: adaptation({
          measurableTriggers: [],
          inferredStates: [inferredState({ estimate: 0.99 })],
        }),
      }),
    );
    expect(m.fire("propose_adaptation").ok).toBe(false);
    expect(m.state).toBe("baseline");
    // a labeled-uncertain inference rides along with a measurable trigger — it never becomes the trigger
    const ok = measurableBurdenSeparated(
      request({ adaptation: adaptation({ inferredStates: [inferredState()] }) }),
    );
    expect(ok.ok).toBe(true);
  });

  it("Policy test: proactive interrupt without need/benefit/urgency/deferral rationale is ineligible", () => {
    // each missing element makes the value test fail, and the failure names the gap
    const gaps = new Map<keyof ReturnType<typeof interruption>, string>([
      ["need", "no recorded unresolved need"],
      ["expectedBenefit", "no recorded expected benefit"],
      ["urgency", "no recorded urgency"],
      ["deferralRationale", "no recorded deferral rationale"],
    ]);
    for (const [field, expected] of gaps) {
      const claim = interruption({ [field]: undefined } as never);
      const r = interruptionHasValueTest(claim);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`interruption value test fails: ${expected}`);
    }
    // with every element recorded the interruption is eligible
    expect(interruptionHasValueTest(interruption()).ok).toBe(true);
  });

  it("TypeScript test: UI cannot render a numeric confidence absent a source declaring that metric and semantics", () => {
    // no source at all — refused
    const bare = renderConfidence(0.9);
    expect(bare.ok).toBe(false);
    expect(bare.reason).toBe(
      "uncertainty_not_fabricated violated: numeric confidence rendered without a source declaring metric and semantics",
    );
    // a source with a metric but no semantics is still fabrication
    const half = renderConfidence(0.9, confidenceSource({ semantics: undefined as never }));
    expect(half.ok).toBe(false);
    expect(half.reason).toMatch(/semantics/);
    // a source declaring metric and semantics, backed by evidence, renders
    const rendered = renderConfidence(0.9, confidenceSource());
    expect(rendered.ok).toBe(true);
  });

  it("when semantically equivalent and feasible, presentation exposes relevant choices/context rather than requiring recall of arbitrary identifiers or prior hidden state", () => {
    // an exposing surface satisfies the property
    expect(recognitionPreferred(presentation()).ok).toBe(true);
    // requiring recall of arbitrary identifiers is a violation only when an
    // equivalent, feasible exposure exists
    const recall = presentation({
      requiresRecallOf: ["request-id-7f3a", "prior hidden scope flag"],
      equivalentExposeAvailable: true,
    });
    const r = recognitionPreferred(recall);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(
      /recognition_preferred_when_equivalent violated: .* requires recall of request-id-7f3a, prior hidden scope flag while an equivalent, feasible exposure exists/,
    );
    // no equivalent exposure exists — recall is tolerated
    expect(
      recognitionPreferred(presentation({ requiresRecallOf: ["request-id-7f3a"] })).ok,
    ).toBe(true);
  });

  it("large or heterogeneous option sets use search, filtering, grouping, staged comparison, or another documented strategy rather than an unstructured exhaustive choice surface", () => {
    // a small homogeneous set is fine unstructured
    expect(choiceComplexityBounded(optionSet()).ok).toBe(true);
    // large or heterogeneous without a strategy is a violation
    const unstructured = choiceComplexityBounded(optionSet({ optionCount: 40, heterogeneous: true }));
    expect(unstructured.ok).toBe(false);
    expect(unstructured.reason).toBe(
      "choice_complexity_bounded violated: surface region-picker presents 40 heterogeneous options as an unstructured exhaustive choice surface with no strategy",
    );
    // each documented strategy bounds the set
    for (const strategy of ["search", "filtering", "grouping", "staged_comparison", "progressive_disclosure"]) {
      expect(
        choiceComplexityBounded(
          optionSet({ optionCount: 40, heterogeneous: true, strategy, strategyDocumented: true }),
        ).ok,
      ).toBe(true);
    }
    // an undocumented strategy does not count
    expect(
      choiceComplexityBounded(
        optionSet({ optionCount: 40, heterogeneous: true, strategy: "vibes", strategyDocumented: false }),
      ).ok,
    ).toBe(false);
  });

  it("frequently used or consequential actions retain stable semantic identity across adaptations and hosts even when visual placement differs", () => {
    // identical semantic identity across hosts and placements holds
    expect(stableActionIdentityHolds(actionIdentity()).ok).toBe(true);
    // a host remapping the semantic identity is a violation, even though the visual placement may differ
    const remapped = actionIdentity({
      placements: [
        { host: "cli", visualPlacement: "top-level", semanticIdAtHost: "deploy.rollback" },
        { host: "web", visualPlacement: "overflow-menu", semanticIdAtHost: "web.cancel-job" },
      ],
    });
    const r = stableActionIdentityHolds(remapped);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "stable_action_identity violated: action deploy.rollback appears as web.cancel-job on host web",
    );
    // the constraint protects frequently used or consequential actions
    const obscure = actionIdentity({ frequentlyUsed: false, consequential: false });
    expect(stableActionIdentityHolds(obscure).ok).toBe(true);
  });

  it("material adaptive changes expose a reason and, where safety permits, a way to revert, disable, or choose a stable presentation", () => {
    // a reasoned, overridable adaptation satisfies the property
    expect(adaptationExplainableAndOverridable(adaptation()).ok).toBe(true);
    // each override channel is acceptable
    for (const kind of ["revert", "disable", "stable_presentation"] as const) {
      expect(
        adaptationExplainableAndOverridable(adaptation({ override: { kind, available: true } })).ok,
      ).toBe(true);
    }
    // no reason — refused
    const unexplained = adaptationExplainableAndOverridable(adaptation({ reason: undefined }));
    expect(unexplained.ok).toBe(false);
    expect(unexplained.reason).toBe(
      "guard adaptation_explainable_and_overridable does not hold: the material adaptation exposes no reason",
    );
    // no override channel — refused
    const locked = adaptationExplainableAndOverridable(adaptation({ override: undefined }));
    expect(locked.ok).toBe(false);
    expect(locked.reason).toMatch(/no way to revert, disable, or choose a stable presentation/);
  });
});
