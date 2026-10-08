// Purpose: invariants for the process-model layer
// Responsibilities: kind/schema, completion criteria, guarded transitions, dependency acyclicity, wait correlation, cancellation semantics, failure/recovery edges, compound-activity patterns
// Rationale: each invariant returns a precise, stable reason so negative tests can assert the exact string — no masked violations
import type {
  BoundedLoop,
  CancellationSemantics,
  DependencyGraph,
  FailureEdges,
  ProcessDefinition,
  RecoveryEdge,
  WaitRecord,
} from "./types";
import { COMPOUND_ACTIVITIES, MODEL_KINDS, RECOVERY_EDGE_TYPES, SCHEMA_VERSION, TRANSITION_IDS } from "./types";

export interface Check {
  readonly ok: boolean;
  readonly reason?: string;
}

export const OK: Check = { ok: true };

export function processKindExplicit(def: ProcessDefinition): Check {
  if (typeof def.modelKind !== "string" || def.modelKind.length === 0) {
    return { ok: false, reason: "process declares no model kind" };
  }
  if (!(MODEL_KINDS as readonly string[]).includes(def.modelKind)) {
    return { ok: false, reason: `unsupported model kind: ${def.modelKind}` };
  }
  if (def.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `process declares schema version '${def.schemaVersion}' but the canonical schema version is '${SCHEMA_VERSION}'`,
    };
  }
  return OK;
}

export function completionCriteriaExplicit(def: ProcessDefinition): Check {
  if (!Array.isArray(def.completionConditions) || def.completionConditions.length === 0) {
    return { ok: false, reason: "process declares no completion conditions" };
  }
  const empty = def.completionConditions.findIndex((c) => typeof c !== "string" || c.length === 0);
  if (empty >= 0) return { ok: false, reason: `completion condition at index ${empty} is empty` };
  return OK;
}

export function conditionsAllEvaluated(def: ProcessDefinition, evaluated: readonly string[]): Check {
  const missing = def.completionConditions.find((c) => !evaluated.includes(c));
  if (missing !== undefined) {
    return { ok: false, reason: `completion condition '${missing}' has not been evaluated successfully` };
  }
  return OK;
}

export function transitionsGuarded(def: ProcessDefinition): Check {
  for (const id of TRANSITION_IDS) {
    const outcome = def.transitionRefusals[id];
    if (typeof outcome !== "string" || outcome.length === 0) {
      return {
        ok: false,
        reason: `transition ${id} declares no refusal outcome for when its guard is false or evaluation is unavailable`,
      };
    }
  }
  return OK;
}

function findCycle(graph: DependencyGraph): string | null {
  const color = new Map<string, number>();
  const stack: string[] = [];
  const visit = (node: string): string | null => {
    color.set(node, 1);
    stack.push(node);
    for (const edge of graph.edges.filter((e) => e.from === node)) {
      const seen = color.get(edge.to) ?? 0;
      if (seen === 1) return [...stack.slice(stack.indexOf(edge.to)), edge.to].join(" -> ");
      if (seen === 0) {
        const found = visit(edge.to);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(node, 2);
    return null;
  };
  for (const node of graph.nodes) {
    if ((color.get(node) ?? 0) === 0) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

export function dependenciesAcyclicOrDeclared(def: ProcessDefinition): Check {
  const cycle = findCycle(def.dependencies);
  if (!cycle) return OK;
  const withCycle = ` (cycle ${cycle})`;
  if (!def.boundedLoop) {
    return {
      ok: false,
      reason: `dependency graph contains cycle ${cycle} and no bounded loop construct declares termination and iteration limits`,
    };
  }
  const loop: BoundedLoop = def.boundedLoop;
  if (typeof loop.terminationCondition !== "string" || loop.terminationCondition.length === 0) {
    return { ok: false, reason: `bounded loop construct declares no termination condition${withCycle}` };
  }
  if (loop.maxIterations <= 0) {
    return { ok: false, reason: `bounded loop construct declares no positive iteration limit${withCycle}` };
  }
  return OK;
}

export function waitsCorrelated(def: ProcessDefinition): Check {
  if (!Array.isArray(def.resumeEvents) || def.resumeEvents.length === 0) {
    return { ok: false, reason: "process declares no correlated resume events" };
  }
  return OK;
}

export function suspendRequiresCorrelation(event: string | undefined): Check {
  if (typeof event !== "string" || event.length === 0) {
    return { ok: false, reason: "suspension requires a correlated resume event" };
  }
  return OK;
}

export function resumeEventCorrelates(record: WaitRecord | null, event: string | undefined): Check {
  if (typeof event !== "string" || event.length === 0) {
    return { ok: false, reason: "no resume event supplied" };
  }
  if (!record) return { ok: false, reason: "no suspended wait is recorded" };
  if (event !== record.resumeEvent) {
    return {
      ok: false,
      reason: `event '${event}' does not correlate with the suspended wait event '${record.resumeEvent}'`,
    };
  }
  return OK;
}

export function cancellationSemanticsDefined(def: ProcessDefinition): Check {
  if (!def.cancellation) return { ok: false, reason: "process declares no cancellation semantics" };
  const c: CancellationSemantics = def.cancellation;
  if (!Array.isArray(c.discardedLocalState) || !Array.isArray(c.compensableExternalEffects)) {
    return {
      ok: false,
      reason: "cancellation semantics must declare discarded local state and compensable external effects",
    };
  }
  return OK;
}

function recoveryEdgeTyped(edge: RecoveryEdge): boolean {
  return (
    (RECOVERY_EDGE_TYPES as readonly string[]).includes(edge.edgeType) &&
    typeof edge.onFailure === "string" &&
    edge.onFailure.length > 0 &&
    typeof edge.reconciliation === "string" &&
    edge.reconciliation.length > 0
  );
}

export function failureRecoveryEdgesExplicit(def: ProcessDefinition): Check {
  if (def.externalEffects.length === 0) return OK;
  const id = `'${def.processId}'`;
  if (!def.failureEdges) {
    return {
      ok: false,
      reason: `effectful process ${id} declares external effects but no failure containment and recovery edges`,
    };
  }
  const edges: FailureEdges = def.failureEdges;
  if (typeof edges.containment !== "string" || edges.containment.length === 0) {
    return { ok: false, reason: `effectful process ${id} declares no failure containment scope` };
  }
  if (edges.recovery.length === 0) {
    return {
      ok: false,
      reason: `effectful process ${id} declares a generic failed terminal with no recovery/reconciliation edges`,
    };
  }
  const untyped = edges.recovery.find((e) => !recoveryEdgeTyped(e));
  if (untyped) {
    return { ok: false, reason: `recovery edge for '${untyped.onFailure}' is not a typed failure/recovery edge` };
  }
  return OK;
}

export function compoundPatternValid(pattern: { activity: string; primitives: readonly string[] }): Check {
  if (!(COMPOUND_ACTIVITIES as readonly string[]).includes(pattern.activity)) {
    return { ok: false, reason: `activity '${pattern.activity}' is not a compound human activity` };
  }
  if (!Array.isArray(pattern.primitives) || pattern.primitives.length === 0) {
    return { ok: false, reason: "an interaction pattern composes at least one contribution primitive" };
  }
  return OK;
}