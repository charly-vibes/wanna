// Purpose: payload bounds checking for event ingress
// Responsibilities: byte, nesting, string, collection, and numeric bounds enforcement with precise paths
// Rationale: payloads are bounded at ingress ([[spec.event_payload_bounded]]) — every breach names its path and bound
import { PAYLOAD_BOUNDS } from "./types";
import type { Check } from "./types";

type Bounds = typeof PAYLOAD_BOUNDS;

function checkString(value: string, path: string, b: Bounds): Check {
  if (value.length > b.maxStringLength) {
    return {
      ok: false,
      reason: `payload string at ${path} exceeds length bound of ${b.maxStringLength}`,
    };
  }
  return { ok: true };
}

function checkNumber(value: number, path: string, b: Bounds): Check {
  if (!Number.isFinite(value)) {
    return { ok: false, reason: `payload number at ${path} is not finite` };
  }
  if (Math.abs(value) > b.maxNumericMagnitude) {
    return {
      ok: false,
      reason: `payload number at ${path} exceeds numeric magnitude bound of ${b.maxNumericMagnitude}`,
    };
  }
  return { ok: true };
}

function checkArray(value: readonly unknown[], path: string, depth: number, b: Bounds): Check {
  if (value.length > b.maxCollectionLength) {
    return {
      ok: false,
      reason: `payload collection at ${path} exceeds length bound of ${b.maxCollectionLength}`,
    };
  }
  for (let i = 0; i < value.length; i++) {
    const sub = checkValue(value[i], `${path}[${i}]`, depth + 1, b);
    if (!sub.ok) return sub;
  }
  return { ok: true };
}

function checkObject(value: Record<string, unknown>, path: string, depth: number, b: Bounds): Check {
  for (const [key, v] of Object.entries(value)) {
    const sub = checkValue(v, path ? `${path}.${key}` : key, depth + 1, b);
    if (!sub.ok) return sub;
  }
  return { ok: true };
}

function checkValue(value: unknown, path: string, depth: number, b: Bounds): Check {
  if (depth > b.maxNestingDepth) {
    return {
      ok: false,
      reason: `payload nesting at ${path} exceeds depth bound of ${b.maxNestingDepth}`,
    };
  }
  if (typeof value === "string") return checkString(value, path, b);
  if (typeof value === "number") return checkNumber(value, path, b);
  if (Array.isArray(value)) return checkArray(value, path, depth, b);
  if (value !== null && typeof value === "object") {
    return checkObject(value as Record<string, unknown>, path, depth, b);
  }
  return { ok: true };
}

export function payloadWithinBounds(payload: unknown): Check {
  const bytes = new TextEncoder().encode(JSON.stringify(payload) ?? "").length;
  if (bytes > PAYLOAD_BOUNDS.maxBytes) {
    return {
      ok: false,
      reason: `payload exceeds byte bound of ${PAYLOAD_BOUNDS.maxBytes} (got ${bytes})`,
    };
  }
  return checkValue(payload, "", 0, PAYLOAD_BOUNDS);
}