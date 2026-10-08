// Purpose: invariants for the interaction-patterns layer
// Responsibilities: composition, completion explicitness, primitive non-override, host neutrality, review judgment separation, diagnosis boundedness, clarification eligibility, versioning, replay resolution
// Rationale: each invariant returns a precise failure reason so negative tests can assert it
import type {
  Check,
  CompletionCondition,
  PatternDefinition,
  PatternNode,
  PatternState,
  TransitionRecord,
} from "./types";
import {
  COMPLETION_CONDITIONS,
  DIAGNOSIS_PHASES,
  JUDGMENT_KINDS,
  PATTERN_FAILURE_EFFECT,
} from "./types";

export {
  COMPLETION_CONDITIONS,
  DIAGNOSIS_PHASES,
  JUDGMENT_KINDS,
  PATTERN_FAILURE_EFFECT,
  PATTERN_KINDS,
} from "./types";
export type { PatternKind } from "./types";

export const PATTERNS_PRESENTATION_VOCABULARY: readonly string[] = [
  "button", "dropdown", "modal", "widget", "layout", "grid", "flexbox",
  "css", "dom", "aria", "renderer", "component", "screen", "toast",
  "dialog", "tooltip", "animation", "tui",
];

const OVERRIDE_KEYS: readonly string[] = [
  "responseSemantics", "validationOverride", "authorityMeaning", "escapeSemantics",
];

function scanPresentation(text: string): string[] {
  const lower = text.toLowerCase();
  return PATTERNS_PRESENTATION_VOCABULARY.filter((token) => lower.includes(token));
}

function nodeOverridesPrimitive(node: PatternNode): string | null {
  const record = node as unknown as Record<string, unknown>;
  return OVERRIDE_KEYS.find((key) => record[key] !== undefined) ?? null;
}

export function patternVersioned(def: PatternDefinition): Check {
  if (def.patternId.length === 0) return { ok: false, reason: "pattern definitions carry an explicit pattern id" };
  if (def.version.length === 0) {
    return { ok: false, reason: "pattern definitions carry explicit versions used in replay and audit" };
  }
  return { ok: true };
}

export function patternComposesPrimitives(def: PatternDefinition, registry: readonly string[]): Check {
  if (def.nodes.length === 0) {
    return { ok: false, reason: "a pattern composes at least one contribution primitive" };
  }
  const nodeCheck = checkNodes(def, registry);
  if (!nodeCheck.ok) return nodeCheck;
  return checkEdges(def);
}

function checkNodes(def: PatternDefinition, registry: readonly string[]): Check {
  for (const node of def.nodes) {
    if (!(registry as readonly string[]).includes(node.primitiveId)) {
      return { ok: false, reason: `node "${node.id}" references unregistered primitive "${node.primitiveId}"` };
    }
    if (node.primitiveVersion.length === 0) {
      return { ok: false, reason: `node "${node.id}" does not declare a primitive version` };
    }
  }
  return { ok: true };
}

function checkEdges(def: PatternDefinition): Check {
  if (def.edges.length === 0) {
    return { ok: false, reason: "no process edges connect the composed primitives" };
  }
  const ids = new Set(def.nodes.map((n) => n.id));
  for (const edge of def.edges) {
    for (const endpoint of [edge.from, edge.to]) {
      if (!ids.has(endpoint)) {
        return { ok: false, reason: `edge endpoint "${endpoint}" is not a declared contribution node` };
      }
    }
  }
  return { ok: true };
}

function missingConditions(def: PatternDefinition): readonly string[] {
  // success is the one universally applicable condition; failure is declared
  // where the pattern can fail (pattern_failure_recorded) but its absence is
  // what makes fail_pattern's guard reachable; the rest apply conditionally
  const declared = (c: CompletionCondition): boolean => def.conditions.includes(c);
  const missing: string[] = [];
  if (!declared("success")) missing.push("success");
  if (def.cancellable === true && !declared("cancellation")) missing.push("cancellation");
  if (def.supportsRejection === true && !declared("rejection")) missing.push("rejection");
  if (def.supportsDeferral === true && !declared("deferral")) missing.push("deferral");
  return missing;
}

export function patternCompletionExplicit(def: PatternDefinition): Check {
  const missing = missingConditions(def);
  if (missing.length > 0) {
    return { ok: false, reason: `missing completion conditions: ${missing.join(", ")}` };
  }
  return { ok: true };
}

export function patternDoesNotOverridePrimitive(def: PatternDefinition): Check {
  for (const node of def.nodes) {
    const key = nodeOverridesPrimitive(node);
    if (key !== null) {
      return {
        ok: false,
        reason: `node "${node.id}" overrides primitive "${node.primitiveId}" ${key} — a pattern references primitive semantics, it does not redefine them`,
      };
    }
  }
  return { ok: true };
}

export function patternStateHostNeutral(def: PatternDefinition): Check {
  const hits = scanPresentation(JSON.stringify(def));
  if (hits.length > 0) {
    return { ok: false, reason: `pattern definition carries host or presentation state: ${hits.join(", ")}` };
  }
  return { ok: true };
}

export function reviewSeparatesJudgments(def: PatternDefinition): Check {
  if (def.kind !== "review") return { ok: true };
  const seen: { id: string; kind: string }[] = [];
  for (const node of def.nodes) {
    const judgment = node.judgmentKind;
    if (judgment === undefined) {
      return { ok: false, reason: `review node "${node.id}" does not declare a judgment kind` };
    }
    if (!(JUDGMENT_KINDS as readonly string[]).includes(judgment)) {
      return { ok: false, reason: `review node "${node.id}" declares unknown judgment kind "${judgment}"` };
    }
    const collapsed = seen.find((s) => s.kind === judgment);
    if (collapsed) {
      return { ok: false, reason: `review nodes "${collapsed.id}" and "${node.id}" collapse judgment kind "${judgment}"` };
    }
    seen.push({ id: node.id, kind: judgment });
  }
  return { ok: true };
}

export function diagnosisIsBounded(def: PatternDefinition): Check {
  if (def.kind !== "diagnosis") return { ok: true };
  const phases = new Set<string>();
  for (const node of def.nodes) {
    const phase = node.diagnosisPhase;
    if (phase === undefined) {
      return { ok: false, reason: `diagnosis node "${node.id}" does not declare a phase` };
    }
    if (!(DIAGNOSIS_PHASES as readonly string[]).includes(phase)) {
      return { ok: false, reason: `diagnosis node "${node.id}" declares unknown phase "${phase}"` };
    }
    phases.add(phase);
  }
  for (const phase of DIAGNOSIS_PHASES) {
    if (!phases.has(phase)) return { ok: false, reason: `diagnosis pattern is missing the "${phase}" phase` };
  }
  const bounded = typeof def.maxIterations === "number" && def.maxIterations > 0;
  if (!bounded && def.interruptible !== true) {
    return {
      ok: false,
      reason: "diagnosis loops must declare a bounded iteration count or an externally interruptible termination",
    };
  }
  return { ok: true };
}

export function clarificationHasTarget(def: PatternDefinition): Check {
  for (const node of def.nodes) {
    if (node.primitiveId !== "primitive.clarify") continue;
    if (node.unresolvedTarget === undefined || node.unresolvedTarget.length === 0) {
      return { ok: false, reason: `clarification step "${node.id}" names no unresolved target — ineligible` };
    }
  }
  return { ok: true };
}

export function resolveReplay(def: PatternDefinition, history: readonly TransitionRecord[]): Check {
  const versioned = patternVersioned(def);
  if (!versioned.ok) return versioned;
  for (let i = 0; i < history.length; i++) {
    const event = history[i]!;
    if (event.patternVersion !== def.version) {
      return {
        ok: false,
        reason: `event ${i + 1} (${event.id}) was recorded against pattern version ${event.patternVersion} but the pattern is ${def.version}`,
      };
    }
  }
  return { ok: true };
}

export function isTerminal(state: PatternState): boolean {
  return ["completed", "unresolved", "cancelled", "failed"].includes(state);
}

export function conditionDeclared(def: PatternDefinition, condition: CompletionCondition): boolean {
  return def.conditions.includes(condition) && (COMPLETION_CONDITIONS as readonly string[]).includes(condition);
}

export { PATTERN_FAILURE_EFFECT as failureEffect };
