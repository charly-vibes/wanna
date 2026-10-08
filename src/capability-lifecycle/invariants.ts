// Purpose: invariant checks for the capability-lifecycle machine
// Responsibilities: the eight corpus constraints as precise-check functions with exact failure reasons
// Rationale: machine guards reuse the same checks at the trust boundary so negative tests can assert reasons verbatim
import type {
  CapabilityComposition,
  CapabilityProposal,
  Check,
  CompositionStep,
  EvaluationPlan,
  InvokeRequest,
  LifecycleState,
  PreviewContext,
} from "./types";
import { DEVELOPMENT_POLICY, INVOKE_POLICY, REQUIRED_GATES, RISK_CLASSES } from "./types";

const OK: Check = { ok: true };

function fail(guard: string, detail: string): Check {
  return { ok: false, reason: `guard ${guard} does not hold: ${detail}` };
}

function declared(value: readonly string[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

const EXPOSURES: readonly { field: keyof CapabilityProposal; label: string }[] = [
  { field: "behavior", label: "intended behavior" },
  { field: "dependencies", label: "dependencies" },
  { field: "effectDeclarations", label: "effect declarations" },
  { field: "tests", label: "tests" },
  { field: "provenance", label: "source provenance" },
];

export function proposalInspectable(proposal: CapabilityProposal): Check {
  const missing = EXPOSURES.filter((e) => {
    const value = proposal[e.field];
    if (typeof value === "string") return value.length === 0;
    return !declared(value as readonly string[]);
  }).map((e) => e.label);
  if (missing.length > 0) {
    return fail("proposal_is_inspectable", `proposal does not expose: ${missing.join(", ")}`);
  }
  return OK;
}

export function previewIsNonCommitting(preview: PreviewContext): Check {
  if (preview.isolated || preview.reversible) return OK;
  return fail("preview_is_non_committing", "preview context is neither isolated nor reversible");
}

export function goalAndSafetySeparate(evaluation: EvaluationPlan): Check {
  if (!declared(evaluation.goalChecks)) {
    return fail("goal_and_safety_checks_separate", "goal checks are not declared");
  }
  if (!declared(evaluation.safetyInvariants)) {
    return fail("goal_and_safety_checks_separate", "safety invariants are not declared");
  }
  const shared = evaluation.goalChecks.filter((g) => evaluation.safetyInvariants.includes(g));
  if (shared.length > 0) {
    return fail(
      "goal_and_safety_checks_separate",
      `goal checks and safety invariants share entries: ${shared.join(", ")}`,
    );
  }
  return OK;
}

export function acceptanceRequiresGate(proposal: CapabilityProposal): Check {
  if (!(RISK_CLASSES as readonly string[]).includes(proposal.riskClass)) {
    return fail("acceptance_requires_gate", `risk class ${proposal.riskClass} is not a declared risk class`);
  }
  const required = REQUIRED_GATES[proposal.riskClass];
  const notPassed = required
    .map((gate) => {
      const result = proposal.gateResults.find((g) => g.gate === gate);
      return { gate, outcome: result === undefined ? "not_run" : result.outcome };
    })
    .filter((g) => g.outcome !== "passed");
  if (notPassed.length > 0) {
    const listed = notPassed.map((g) => `${g.gate} (${g.outcome})`).join(", ");
    return fail(
      "acceptance_requires_gate",
      `risk class ${proposal.riskClass} requires gate(s) not passed: ${listed}`,
    );
  }
  return OK;
}

export function failedCandidateNotActive(proposal: CapabilityProposal): Check {
  const required = REQUIRED_GATES[proposal.riskClass] ?? [];
  const failed = proposal.gateResults
    .filter((g) => g.outcome === "failed" && required.includes(g.gate))
    .map((g) => g.gate);
  if (failed.length > 0) {
    return fail("failed_candidate_not_active", `required gate(s) failed: ${failed.join(", ")}`);
  }
  return OK;
}

export function retirementAndRecoverySupported(acceptedRevisions: readonly string[]): Check {
  if (acceptedRevisions.length === 0) {
    return fail("retirement_and_recovery_supported", "no accepted revision exists to restore");
  }
  return OK;
}

export function invokeIsExistingUse(state: LifecycleState, request: InvokeRequest): Check {
  if (state !== "registered") {
    return fail(
      "existing_use_distinct_from_development",
      `capability ${request.capabilityId} is not registered (state: ${state})`,
    );
  }
  if (request.policyPath !== INVOKE_POLICY) {
    return fail(
      "existing_use_distinct_from_development",
      `invocation must use the invoke policy path (${INVOKE_POLICY}), not the development policy path (${DEVELOPMENT_POLICY})`,
    );
  }
  return OK;
}

function availabilityCheck(
  steps: readonly CompositionStep[],
  available: readonly string[],
): Check {
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      const inComposition = steps.some((s) => s.id === dep);
      if (inComposition || available.includes(dep)) continue;
      return fail("composition_is_bounded", `step ${step.id} depends on unavailable dependency ${dep}`);
    }
  }
  return OK;
}

function typeCompatibilityCheck(steps: readonly CompositionStep[]): Check {
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      const producer = steps.find((s) => s.id === dep);
      if (producer && producer.outputType !== step.inputType) {
        return fail(
          "composition_is_bounded",
          `dependency ${dep} produces ${producer.outputType} but step ${step.id} consumes ${step.inputType}`,
        );
      }
    }
  }
  return OK;
}

function cycleCheck(steps: readonly CompositionStep[]): Check {
  for (const start of steps) {
    const cycle = findCycle(start.id, start.id, steps, new Set<string>());
    if (cycle) {
      return fail("composition_is_bounded", `composition contains a dependency cycle involving ${cycle}`);
    }
  }
  return OK;
}

function findCycle(
  current: string,
  target: string,
  steps: readonly CompositionStep[],
  visited: Set<string>,
): string | null {
  if (visited.has(current)) return null;
  visited.add(current);
  const step = steps.find((s) => s.id === current);
  if (!step) return null;
  for (const dep of step.dependsOn) {
    if (dep === target) return target;
    const deeper = findCycle(dep, target, steps, visited);
    if (deeper) return deeper;
  }
  return null;
}

function budgetCheck(composition: CapabilityComposition): Check {
  const cost = composition.steps.reduce((sum, s) => sum + s.cost, 0);
  if (cost > composition.executionBudget) {
    return fail(
      "composition_is_bounded",
      `composition cost ${cost} exceeds execution budget ${composition.executionBudget}`,
    );
  }
  return OK;
}

export function compositionIsBounded(
  composition: CapabilityComposition,
  available: readonly string[],
): Check {
  const availability = availabilityCheck(composition.steps, available);
  if (!availability.ok) return availability;
  const types = typeCompatibilityCheck(composition.steps);
  if (!types.ok) return types;
  const cycle = cycleCheck(composition.steps);
  if (!cycle.ok) return cycle;
  return budgetCheck(composition);
}
