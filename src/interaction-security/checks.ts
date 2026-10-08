// Purpose: the five security checks and the full validation pipeline for the interaction-security gate
// Responsibilities: schema, catalog, size, rendering, and ownership checks; each failure returns a typed Check with a stable reason code
// Rationale: payloads reach validated state only after all checks pass; each failure names its check and bound precisely
import { byteLength, catalogComponentFor } from "./policy";
import type {
  AgentPayload,
  Check,
  ComponentMapping,
  SecurityPolicy,
  TrustedOwnership,
} from "./types";

function fail(code: string, reason: string): Check {
  return { ok: false, code, reason };
}

function dataIsJson(value: unknown): boolean {
  if (value === undefined || value === null || Array.isArray(value)) return true;
  return typeof value === "object";
}

export function schemaCheck(payload: AgentPayload): Check {
  if (typeof payload.kind !== "string" || payload.kind.length === 0) {
    return fail("schema_invalid", "schema check failed: kind must be a non-empty string");
  }
  if (typeof payload.label !== "string" || payload.label.length === 0) {
    return fail("schema_invalid", "schema check failed: label must be a non-empty string");
  }
  if (payload.description !== undefined && typeof payload.description !== "string") {
    return fail("schema_invalid", "schema check failed: description must be a string");
  }
  if (payload.options !== undefined && !optionsAreStrings(payload.options)) {
    return fail("schema_invalid", "schema check failed: options must be an array of strings");
  }
  if (!dataIsJson(payload.data)) {
    return fail("schema_invalid", "schema check failed: data must be a JSON object or array");
  }
  return { ok: true };
}

function optionsAreStrings(options: readonly string[]): boolean {
  return (options as readonly unknown[]).every((o) => typeof o === "string");
}

export function catalogCheck(
  payload: AgentPayload,
  catalog: readonly ComponentMapping[],
): Check {
  const component = catalogComponentFor(payload.kind, catalog);
  if (component === null) {
    return fail(
      "kind_not_registered",
      `catalog check failed: kind '${payload.kind}' is not registered in the trusted catalog`,
    );
  }
  if (payload.component !== undefined && payload.component !== component) {
    return fail(
      "component_not_trusted",
      `catalog check failed: component '${payload.component}' is not the trusted mapping for kind '${payload.kind}'`,
    );
  }
  return { ok: true };
}

function serializedBytes(payload: AgentPayload): number | null {
  try {
    return byteLength(JSON.stringify(payload) ?? "");
  } catch {
    return null;
  }
}

function bytesCheck(payload: AgentPayload, policy: SecurityPolicy): Check | null {
  const bytes = serializedBytes(payload);
  if (bytes === null || bytes > policy.maxPayloadBytes) {
    return fail(
      "payload_too_large",
      `size check failed: payload of ${bytes ?? 0} bytes exceeds maxPayloadBytes (${policy.maxPayloadBytes})`,
    );
  }
  return null;
}

function fieldLengthCheck(payload: AgentPayload, policy: SecurityPolicy): Check | null {
  for (const name of ["label", "description"] as const) {
    const value = payload[name];
    if (typeof value === "string" && value.length > policy.maxFieldLength) {
      return fail(
        "field_too_long",
        `size check failed: field '${name}' length ${value.length} exceeds maxFieldLength (${policy.maxFieldLength})`,
      );
    }
  }
  return null;
}

function optionCountCheck(payload: AgentPayload, policy: SecurityPolicy): Check | null {
  const count = payload.options?.length ?? 0;
  if (count > policy.maxOptionCount) {
    return fail(
      "too_many_options",
      `size check failed: option count ${count} exceeds maxOptionCount (${policy.maxOptionCount})`,
    );
  }
  return null;
}

function jsonDepth(value: unknown, seen: ReadonlySet<object>): number {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return 0;
  const next = new Set(seen);
  next.add(value as object);
  let max = 0;
  for (const child of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, jsonDepth(child, next) + 1);
  }
  return max;
}

function nestingCheck(payload: AgentPayload, policy: SecurityPolicy): Check | null {
  const depth = jsonDepth(payload.data, new Set());
  if (depth > policy.maxNestingDepth) {
    return fail(
      "nesting_too_deep",
      `size check failed: data nesting depth ${depth} exceeds maxNestingDepth (${policy.maxNestingDepth})`,
    );
  }
  return null;
}

export function sizeCheck(payload: AgentPayload, policy: SecurityPolicy): Check {
  const bytes = bytesCheck(payload, policy);
  if (bytes) return bytes;
  const fields = fieldLengthCheck(payload, policy);
  if (fields) return fields;
  const options = optionCountCheck(payload, policy);
  if (options) return options;
  const nesting = nestingCheck(payload, policy);
  if (nesting) return nesting;
  return { ok: true };
}

export function renderSafetyCheck(payload: AgentPayload, policy: SecurityPolicy): Check {
  if (payload.url === undefined) return { ok: true };
  let parsed: URL;
  try {
    parsed = new URL(payload.url);
  } catch {
    return fail("url_invalid", "rendering check failed: url is not parseable");
  }
  const scheme = parsed.protocol.replace(/:$/, "");
  if (!policy.allowedUrlSchemes.includes(scheme)) {
    return fail(
      "url_scheme_disallowed",
      `rendering check failed: url scheme '${scheme}' is not allowed`,
    );
  }
  if (!policy.allowedUrlHosts.includes(parsed.hostname)) {
    return fail(
      "url_host_disallowed",
      `rendering check failed: url host '${parsed.hostname}' is not allowed`,
    );
  }
  return { ok: true };
}

export function ownershipCheck(payload: AgentPayload, trusted: TrustedOwnership): Check {
  if (payload.taskRevision !== trusted.taskRevision) {
    return fail(
      "task_mismatch",
      `ownership check failed: claimed task revision '${payload.taskRevision}' does not match trusted task revision '${trusted.taskRevision}'`,
    );
  }
  if (payload.sessionId !== trusted.sessionId) {
    return fail(
      "session_mismatch",
      `ownership check failed: claimed session '${payload.sessionId}' does not match trusted session '${trusted.sessionId}'`,
    );
  }
  if (payload.interactionId !== trusted.interactionId) {
    return fail(
      "interaction_mismatch",
      `ownership check failed: claimed interaction '${payload.interactionId}' does not match trusted interaction '${trusted.interactionId}'`,
    );
  }
  if (payload.revision < trusted.currentRevision) {
    return fail(
      "stale_revision",
      `ownership check failed: claimed revision ${payload.revision} is stale (current revision ${trusted.currentRevision})`,
    );
  }
  return { ok: true };
}

function asFailure(check: Check): Check | null {
  return check.ok ? null : check;
}

export function payloadPassesSecurityValidation(
  payload: AgentPayload,
  policy: SecurityPolicy,
  catalog: readonly ComponentMapping[],
  trusted: TrustedOwnership,
): Check {
  const failed =
    asFailure(schemaCheck(payload)) ??
    asFailure(catalogCheck(payload, catalog)) ??
    asFailure(sizeCheck(payload, policy)) ??
    asFailure(renderSafetyCheck(payload, policy)) ??
    asFailure(ownershipCheck(payload, trusted));
  return failed ?? { ok: true };
}
