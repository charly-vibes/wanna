// Purpose: test fixtures for the capability-lifecycle machine
// Responsibilities: build canonical valid proposals, failing candidates, compositions, and pre-walked machines
// Rationale: single source of shared capability vocabulary for transitions and properties tests
import type {
  CapabilityComposition,
  CapabilityProposal,
  LifecycleState,
  LifecycleTransitionId,
} from "../../src/capability-lifecycle/types";
import { createLifecycleMachine } from "../../src/capability-lifecycle/machine";
import type { LifecycleMachine } from "../../src/capability-lifecycle/machine";

type WalkPath = Record<LifecycleState, readonly LifecycleTransitionId[]>;

const WALK_PATHS: WalkPath = {
  proposed: [],
  inspected: ["inspect_candidate"],
  previewed: ["inspect_candidate", "preview_candidate"],
  evaluated: ["inspect_candidate", "preview_candidate", "evaluate_candidate"],
  approved: ["inspect_candidate", "preview_candidate", "evaluate_candidate", "approve_candidate"],
  registered: [
    "inspect_candidate", "preview_candidate", "evaluate_candidate", "approve_candidate", "register_candidate",
  ],
  rejected: ["inspect_candidate", "preview_candidate", "evaluate_candidate", "reject_candidate"],
  retired: [
    "inspect_candidate", "preview_candidate", "evaluate_candidate", "approve_candidate", "register_candidate",
    "retire_capability",
  ],
};

function walkedTo(state: LifecycleState, overrides: Partial<CapabilityProposal> = {}): LifecycleMachine {
  const m = createLifecycleMachine(validProposal(overrides));
  for (const id of WALK_PATHS[state]) m.fire(id);
  return m;
}

/** Machine walked from `proposed` through the canonical path ending at `state`. */
export function machineAt(state: LifecycleState, overrides: Partial<CapabilityProposal> = {}): LifecycleMachine {
  return walkedTo(state, overrides);
}

export function validProposal(overrides: Partial<CapabilityProposal> = {}): CapabilityProposal {
  return {
    capabilityId: "cap.export-notes",
    revision: "rev-1",
    behavior: "export the current session notes to a markdown file",
    dependencies: ["catalog.read"],
    effectDeclarations: ["writes the user-selected export file"],
    tests: ["conformance/export-notes-basic"],
    provenance: "human-authored:platform-team",
    preview: { isolated: true, reversible: true },
    evaluation: {
      goalChecks: ["exported file matches the session notes"],
      safetyInvariants: ["no writes outside the chosen export path"],
    },
    riskClass: "standard",
    gateResults: [
      { gate: "conformance", outcome: "passed" },
      { gate: "safety", outcome: "passed" },
    ],
    ...overrides,
  };
}

export function failingProposal(): CapabilityProposal {
  return validProposal({
    gateResults: [
      { gate: "conformance", outcome: "passed" },
      { gate: "safety", outcome: "failed" },
    ],
  });
}

function compositionOf(steps: CapabilityComposition["steps"]): CapabilityComposition {
  return { executionBudget: 10, steps };
}

export function linearComposition(): CapabilityComposition {
  return compositionOf([
    { id: "a", capabilityId: "cap.compose.a", dependsOn: [], inputType: "text", outputType: "json", cost: 4 },
    { id: "b", capabilityId: "cap.compose.b", dependsOn: ["a"], inputType: "json", outputType: "json", cost: 4 },
  ]);
}

export function cyclicComposition(): CapabilityComposition {
  return compositionOf([
    { id: "a", capabilityId: "cap.compose.a", dependsOn: ["b"], inputType: "json", outputType: "json", cost: 2 },
    { id: "b", capabilityId: "cap.compose.b", dependsOn: ["a"], inputType: "json", outputType: "json", cost: 2 },
  ]);
}


