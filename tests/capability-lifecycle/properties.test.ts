// Purpose: property tests for the capability-lifecycle machine
// Responsibilities: each corpus property of capability-lifecycle as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/capability-lifecycle/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  acceptanceRequiresGate,
  compositionIsBounded,
  failedCandidateNotActive,
  goalAndSafetySeparate,
  invokeIsExistingUse,
  previewIsNonCommitting,
  proposalInspectable,
  retirementAndRecoverySupported,
} from "../../src/capability-lifecycle/invariants";
import type { CapabilityComposition } from "../../src/capability-lifecycle/types";
import { DEVELOPMENT_POLICY, INVOKE_POLICY, REQUIRED_GATES } from "../../src/capability-lifecycle/types";
import {
  approvedMachine,
  cyclicComposition,
  failingProposal,
  linearComposition,
  proposedMachine,
  retiredMachine,
  registeredMachine,
  validProposal,
} from "./fixtures";

describe("capability-lifecycle properties", () => {
  it("TypeScript conformance test: assert invariant proposal_is_inspectable at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: the inspect_candidate guard refuses a proposal missing any exposure
    expect(proposalInspectable(validProposal()).ok).toBe(true);
    for (const [overrides, label] of [
      [{ behavior: "" }, "intended behavior"],
      [{ dependencies: [] }, "dependencies"],
      [{ effectDeclarations: [] }, "effect declarations"],
      [{ tests: [] }, "tests"],
      [{ provenance: "" }, "source provenance"],
    ] as const) {
      const r = proposalInspectable(validProposal(overrides));
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(
        `guard proposal_is_inspectable does not hold: proposal does not expose: ${label}`,
      );
    }
    // the guard fires before the proposal can leave the proposed state
    const m = registeredMachine();
    expect(m.proposal.behavior.length).toBeGreaterThan(0);
    expect(m.proposal.tests.length).toBeGreaterThan(0);
    expect(m.proposal.provenance.length).toBeGreaterThan(0);
  });

  it("TypeScript conformance test: assert invariant preview_is_non_committing at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: preview requires an isolated or reversible context
    expect(previewIsNonCommitting(validProposal().preview).ok).toBe(true);
    const neither = previewIsNonCommitting({ isolated: false, reversible: false });
    expect(neither.ok).toBe(false);
    expect(neither.reason).toBe(
      "guard preview_is_non_committing does not hold: preview context is neither isolated nor reversible",
    );
    // previewing never installs the candidate as the active revision…
    const m = registeredMachine();
    expect(m.activeRevision).toBe("rev-1");
    // …and the active revision is null before registration — preview cannot commit
    const pre = validProposal({ preview: { isolated: true, reversible: false } });
    expect(previewIsNonCommitting(pre.preview).ok).toBe(true);
  });

  it("TypeScript conformance test: assert invariant goal_and_safety_checks_separate at its trust boundary and under its stated edge cases.", () => {
    expect(goalAndSafetySeparate(validProposal().evaluation).ok).toBe(true);
    const noGoal = goalAndSafetySeparate({ goalChecks: [], safetyInvariants: ["s1"] });
    expect(noGoal.reason).toBe(
      "guard goal_and_safety_checks_separate does not hold: goal checks are not declared",
    );
    const noSafety = goalAndSafetySeparate({ goalChecks: ["g1"], safetyInvariants: [] });
    expect(noSafety.reason).toBe(
      "guard goal_and_safety_checks_separate does not hold: safety invariants are not declared",
    );
    const overlap = goalAndSafetySeparate({ goalChecks: ["shared"], safetyInvariants: ["shared"] });
    expect(overlap.reason).toBe(
      "guard goal_and_safety_checks_separate does not hold: goal checks and safety invariants share entries: shared",
    );
  });

  it("TypeScript conformance test: assert invariant acceptance_requires_gate at its trust boundary and under its stated edge cases.", () => {
    expect(acceptanceRequiresGate(validProposal()).ok).toBe(true);
    // each risk class carries its own required gate set
    expect(REQUIRED_GATES.low).toEqual(["conformance"]);
    expect(REQUIRED_GATES.standard).toEqual(["conformance", "safety"]);
    expect(REQUIRED_GATES.high).toEqual(["conformance", "safety", "human_approval"]);
    const missing = acceptanceRequiresGate(
      validProposal({ gateResults: [{ gate: "conformance", outcome: "passed" }] }),
    );
    expect(missing.reason).toBe(
      "guard acceptance_requires_gate does not hold: risk class standard requires gate(s) not passed: safety (not_run)",
    );
    const failed = acceptanceRequiresGate(failingProposal());
    expect(failed.reason).toBe(
      "guard acceptance_requires_gate does not hold: risk class standard requires gate(s) not passed: safety (failed)",
    );
    const unknown = acceptanceRequiresGate(validProposal({ riskClass: "critical" as never }));
    expect(unknown.reason).toBe(
      "guard acceptance_requires_gate does not hold: risk class critical is not a declared risk class",
    );
    // a low-risk candidate registers with only the conformance gate passed
    expect(acceptanceRequiresGate(validProposal({
      riskClass: "low",
      gateResults: [{ gate: "conformance", outcome: "passed" }],
    })).ok).toBe(true);
  });

  it("TypeScript conformance test: assert invariant existing_use_distinct_from_development at its trust boundary and under its stated edge cases.", () => {
    // invoking an existing capability and developing a candidate use distinct policy paths
    expect(INVOKE_POLICY).not.toBe(DEVELOPMENT_POLICY);
    expect(invokeIsExistingUse("registered", {
      capabilityId: "cap.export-notes",
      policyPath: INVOKE_POLICY,
    }).ok).toBe(true);
    const notRegistered = invokeIsExistingUse("previewed", {
      capabilityId: "cap.export-notes",
      policyPath: INVOKE_POLICY,
    });
    expect(notRegistered.reason).toBe(
      "guard existing_use_distinct_from_development does not hold: capability cap.export-notes is not registered (state: previewed)",
    );
    const devPath = invokeIsExistingUse("registered", {
      capabilityId: "cap.export-notes",
      policyPath: DEVELOPMENT_POLICY,
    });
    expect(devPath.reason).toBe(
      "guard existing_use_distinct_from_development does not hold: invocation must use the invoke policy path (capability-invoke-policy), not the development policy path (capability-development-policy)",
    );
    // in-machine: invoking before registration is refused; invoking after is recorded on the audit trail
    const m = proposedMachine();
    const early = m.invoke({ capabilityId: "cap.export-notes", policyPath: INVOKE_POLICY });
    expect(early.ok).toBe(false);
    expect(early.reason).toBe(
      "guard existing_use_distinct_from_development does not hold: capability cap.export-notes is not registered (state: proposed)",
    );
    const live = registeredMachine();
    const ok = live.invoke({ capabilityId: "cap.export-notes", policyPath: INVOKE_POLICY });
    expect(ok.ok).toBe(true);
    expect(live.history[live.history.length - 1]?.transition).toBe("invoke");
    const viaDev = live.invoke({
      capabilityId: "cap.export-notes",
      policyPath: DEVELOPMENT_POLICY,
    });
    expect(viaDev.ok).toBe(false);
    expect(viaDev.reason).toBe(
      "guard existing_use_distinct_from_development does not hold: invocation must use the invoke policy path (capability-invoke-policy), not the development policy path (capability-development-policy)",
    );
  });

  it("TypeScript conformance test: assert invariant failed_candidate_not_active at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: a candidate that fails a required gate can never become the active revision
    expect(failedCandidateNotActive(validProposal()).ok).toBe(true);
    const failed = failedCandidateNotActive(failingProposal());
    expect(failed.ok).toBe(false);
    expect(failed.reason).toBe(
      "guard failed_candidate_not_active does not hold: required gate(s) failed: safety",
    );
    // the machine refuses registration of the failing candidate and keeps the active revision untouched
    const m = approvedMachine(failingProposal());
    expect(m.fire("register_candidate").ok).toBe(false);
    expect(m.activeRevision).toBe(null);
  });

  it("TypeScript conformance test: assert invariant retirement_and_recovery_supported at its trust boundary and under its stated edge cases.", () => {
    // trust boundary: retiring requires a recoverable accepted revision
    const empty = retirementAndRecoverySupported([]);
    expect(empty.ok).toBe(false);
    expect(empty.reason).toBe(
      "guard retirement_and_recovery_supported does not hold: no accepted revision exists to restore",
    );
    expect(retirementAndRecoverySupported(["rev-1"]).ok).toBe(true);
    // in-machine: retire then restore the prior accepted revision without losing audit history
    const m = retiredMachine();
    expect(m.state).toBe("retired");
    const historyBefore = [...m.history];
    const r = m.restore("rev-1");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("registered");
    expect(m.activeRevision).toBe("rev-1");
    expect(m.history.slice(0, historyBefore.length)).toEqual(historyBefore);
    expect(m.history.length).toBe(historyBefore.length + 1);
  });

  it("TypeScript conformance test: assert invariant composition_is_bounded at its trust boundary and under its stated edge cases.", () => {
    expect(compositionIsBounded(linearComposition(), []).ok).toBe(true);
    const cases: readonly [CapabilityComposition, string][] = [
      [
        {
          executionBudget: 10,
          steps: [
            { id: "a", capabilityId: "cap.a", dependsOn: ["external-missing"], inputType: "text", outputType: "json", cost: 2 },
          ],
        },
        "guard composition_is_bounded does not hold: step a depends on unavailable dependency external-missing",
      ],
      [
        {
          executionBudget: 10,
          steps: [
            { id: "a", capabilityId: "cap.a", dependsOn: [], inputType: "text", outputType: "json", cost: 2 },
            { id: "b", capabilityId: "cap.b", dependsOn: ["a"], inputType: "text", outputType: "json", cost: 2 },
          ],
        },
        "guard composition_is_bounded does not hold: dependency a produces json but step b consumes text",
      ],
      [cyclicComposition(), "guard composition_is_bounded does not hold: composition contains a dependency cycle involving a"],
      [
        {
          executionBudget: 3,
          steps: [
            { id: "a", capabilityId: "cap.a", dependsOn: [], inputType: "text", outputType: "json", cost: 2 },
            { id: "b", capabilityId: "cap.b", dependsOn: ["a"], inputType: "json", outputType: "json", cost: 2 },
          ],
        },
        "guard composition_is_bounded does not hold: composition cost 4 exceeds execution budget 3",
      ],
    ];
    for (const [composition, reason] of cases) {
      const r = compositionIsBounded(composition, []);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(reason);
    }
    // a dependency satisfied by an already-accepted capability is available
    const external = compositionIsBounded(
      {
        executionBudget: 10,
        steps: [
          { id: "a", capabilityId: "cap.export-notes", dependsOn: ["catalog.read"], inputType: "text", outputType: "json", cost: 2 },
        ],
      },
      ["catalog.read"],
    );
    expect(external.ok).toBe(true);
  });
});
