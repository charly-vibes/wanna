// Purpose: rendering-side checks for the presentation-contract layer
// Responsibilities: response_semantics_preserved, fallback_is_semantic, uncertainty_semantics_preserved
// Rationale: host render requests are the trust boundary — every check returns a precise failure reason
import type {
  Check,
  FallbackRequest,
  RenderedAction,
  RenderedMetric,
  SemanticAction,
  UncertaintyMetric,
} from "./types";
import { FALLBACK_KINDS } from "./types";

function sameSchema(
  a: readonly SemanticAction["responseSchema"],
  b: readonly RenderedAction["responseSchema"],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function responseSemanticsPreserved(
  declared: readonly SemanticAction[],
  rendered: readonly RenderedAction[],
): Check {
  for (const action of declared) {
    const host = rendered.find((r) => r.actionId === action.id);
    if (!host) return { ok: false, reason: `host rendering drops declared action ${action.id}` };
    if (host.meaning !== action.meaning) {
      return { ok: false, reason: `host rendering changed the meaning of action ${action.id}` };
    }
    if (!sameSchema(action.responseSchema, host.responseSchema)) {
      return { ok: false, reason: `host rendering changed the response schema of action ${action.id}` };
    }
  }
  const declaredIds = new Set(declared.map((a) => a.id));
  for (const host of rendered) {
    if (!declaredIds.has(host.actionId)) {
      return { ok: false, reason: `host rendering introduces undeclared action ${host.actionId}` };
    }
  }
  return { ok: true };
}

export function fallbackIsSemantic(
  declared: readonly SemanticAction[],
  request: FallbackRequest,
): Check {
  const native = new Set(request.nativeActionIds);
  for (const action of declared) {
    if (native.has(action.id)) continue;
    const sub = request.substitutions.find((s) => s.actionId === action.id);
    if (!sub) {
      return {
        ok: false,
        reason: `no documented semantically equivalent fallback for action ${action.id}; the host must return unsupported`,
      };
    }
    if (!(FALLBACK_KINDS as readonly string[]).includes(sub.fallbackKind)) {
      return { ok: false, reason: `undocumented fallback kind: ${sub.fallbackKind}` };
    }
  }
  return { ok: true };
}

export function uncertaintySemanticsPreserved(
  supplied: readonly UncertaintyMetric[],
  rendered: readonly RenderedMetric[],
): Check {
  for (const metric of rendered) {
    const origin = supplied.find((m) => m.id === metric.metricId);
    if (!origin) {
      return { ok: false, reason: `hosts do not fabricate confidence: metric ${metric.metricId} was not supplied` };
    }
    if (origin.value !== metric.value) {
      return { ok: false, reason: `host rendering altered uncertainty metric ${metric.metricId}` };
    }
    if (origin.semantics === "") {
      return { ok: false, reason: `metric ${metric.metricId} is supplied without defined semantics` };
    }
    if (origin.evidenceRefs.length === 0) {
      return { ok: false, reason: `metric ${metric.metricId} is supplied without evidence` };
    }
    if (metric.forcedAcrossModalities === true) {
      return { ok: false, reason: "hosts do not force one visualization technique across modalities" };
    }
  }
  return { ok: true };
}