// Purpose: transition tests for the capability-lifecycle model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways
// Rationale: table-driven machine must mirror [[spec]] row for row; guards must fail with precise reasons
import { describe, it, expect } from "vitest";
import { LIFECYCLE_TRANSITIONS } from "../../src/capability-lifecycle/machine";
import {
  approvedMachine,
  evaluatedMachine,
  evaluatedFailingMachine,
  inspectedMachine,
  previewedMachine,
  proposedMachine,
  registeredMachine,
  validProposal,
  cyclicComposition,
} from "./fixtures";

describe("capability-lifecycle transitions", () => {
  it("the transition table mirrors the spec Model rows exactly", () => {
    expect(LIFECYCLE_TRANSITIONS).toEqual([
      { id: "inspect_candidate", from: "proposed", to: "inspected" },
      { id: "preview_candidate", from: "inspected", to: "previewed" },
      { id: "evaluate_candidate", from: "previewed", to: "evaluated" },
      { id: "approve_candidate", from: "evaluated", to: "approved" },
      { id: "register_candidate", from: "approved", to: "registered" },
      { id: "reject_candidate", from: "evaluated", to: "rejected" },
      { id: "retire_capability", from: "registered", to: "retired" },
    ]);
  });

  it("inspect_candidate moves proposed → inspected when proposal_is_inspectable holds", () => {
    const m = proposedMachine();
    const r = m.fire("inspect_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("inspected");
    expect(m.history).toHaveLength(1);
  });

  it("inspect_candidate refuses an uninspectable proposal, naming the missing exposure exactly", () => {
    const m = proposedMachine({ behavior: "", tests: [] });
    const r = m.fire("inspect_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard proposal_is_inspectable does not hold: proposal does not expose: intended behavior, tests",
    );
    expect(m.state).toBe("proposed");
  });

  it("preview_candidate moves inspected → previewed without committing the candidate as the active revision", () => {
    const m = inspectedMachine();
    const r = m.fire("preview_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("previewed");
    expect(m.activeRevision).toBe(null);
  });

  it("preview_candidate refuses when the preview context is neither isolated nor reversible", () => {
    const m = inspectedMachine({ preview: { isolated: false, reversible: false } });
    const r = m.fire("preview_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard preview_is_non_committing does not hold: preview context is neither isolated nor reversible",
    );
    expect(m.state).toBe("inspected");
  });

  it("evaluate_candidate moves previewed → evaluated when goal and safety checks are separate", () => {
    const m = previewedMachine();
    const r = m.fire("evaluate_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("evaluated");
  });

  it("evaluate_candidate refuses when goal checks and safety invariants are not separate", () => {
    const m = previewedMachine({
      evaluation: { goalChecks: [], safetyInvariants: ["no writes outside the chosen export path"] },
    });
    const r = m.fire("evaluate_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard goal_and_safety_checks_separate does not hold: goal checks are not declared",
    );
    // overlapping entries are not separate either
    const m2 = previewedMachine({
      evaluation: {
        goalChecks: ["no writes outside the chosen export path"],
        safetyInvariants: ["no writes outside the chosen export path"],
      },
    });
    const r2 = m2.fire("evaluate_candidate");
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "guard goal_and_safety_checks_separate does not hold: goal checks and safety invariants share entries: no writes outside the chosen export path",
    );
  });

  it("approve_candidate moves evaluated → approved when all gates for the risk class passed", () => {
    const m = evaluatedMachine();
    const r = m.fire("approve_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("approved");
  });

  it("approve_candidate refuses when a required gate for the risk class has not passed", () => {
    const m = evaluatedMachine({ gateResults: [{ gate: "conformance", outcome: "passed" }] });
    const r = m.fire("approve_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard acceptance_requires_gate does not hold: risk class standard requires gate(s) not passed: safety (not_run)",
    );
  });

  it("register_candidate moves approved → registered and makes the revision the active one", () => {
    const m = approvedMachine();
    const r = m.fire("register_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("registered");
    expect(m.activeRevision).toBe("rev-1");
    expect(m.acceptedRevisions).toEqual(["rev-1"]);
  });

  it("register_candidate refuses when the composition is not bounded, with the exact reason", () => {
    const m = approvedMachine(validProposal({ composition: cyclicComposition() }));
    const r = m.fire("register_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard composition_is_bounded does not hold: composition contains a dependency cycle involving a",
    );
    expect(m.activeRevision).toBe(null);
  });

  it("reject_candidate moves evaluated → rejected when failed_candidate_not_active does not hold, recording the failure reason", () => {
    const m = evaluatedFailingMachine();
    const r = m.fire("reject_candidate");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("rejected");
    expect(m.rejectionReason).toBe(
      "guard failed_candidate_not_active does not hold: required gate(s) failed: safety",
    );
    expect(m.activeRevision).toBe(null);
  });

  it("reject_candidate refuses a passing candidate — there is nothing to reject", () => {
    const m = evaluatedMachine();
    const r = m.fire("reject_candidate");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "guard ¬failed_candidate_not_active does not hold: the candidate passed all required gates for its risk class",
    );
    expect(m.state).toBe("evaluated");
  });

  it("retire_capability moves registered → retired and supports restoring the accepted revision", () => {
    const m = registeredMachine();
    const r = m.fire("retire_capability");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("retired");
    const historyBefore = [...m.history];
    const restored = m.restore("rev-1");
    expect(restored.ok).toBe(true);
    expect(m.state).toBe("registered");
    expect(m.activeRevision).toBe("rev-1");
    // recovery never erases audit history — restore only appends
    expect(m.history.length).toBe(historyBefore.length + 1);
    expect(m.history.slice(0, historyBefore.length)).toEqual(historyBefore);
    expect(m.history[m.history.length - 1]?.transition).toBe("restore");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = proposedMachine();
    for (const row of LIFECYCLE_TRANSITIONS) {
      if (row.from === "proposed") continue;
      const r = m.fire(row.id);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe(`transition ${row.id} cannot fire from state proposed`);
    }
    expect(m.state).toBe("proposed");
  });

  it("restore refuses a revision that was never accepted", () => {
    const m = registeredMachine();
    m.fire("retire_capability");
    const r = m.restore("rev-9");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("restore revision rev-9 cannot be restored: it was never accepted");
  });

  it("a full happy-path walk passes every guard in sequence", () => {
    const m = proposedMachine(validProposal({ composition: {
      executionBudget: 10,
      steps: [
        { id: "a", capabilityId: "cap.export-notes", dependsOn: [], inputType: "text", outputType: "json", cost: 2 },
      ],
    } }));
    expect(m.fire("inspect_candidate").ok).toBe(true);
    expect(m.fire("preview_candidate").ok).toBe(true);
    expect(m.fire("evaluate_candidate").ok).toBe(true);
    expect(m.fire("approve_candidate").ok).toBe(true);
    expect(m.fire("register_candidate").ok).toBe(true);
    expect(m.fire("retire_capability").ok).toBe(true);
    expect(m.state).toBe("retired");
    expect(m.history).toHaveLength(6);
  });
});
