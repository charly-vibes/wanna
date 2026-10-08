// Purpose: invariants and transition guards for the interaction-contract layer
// Responsibilities: identity/version, kind allowlist, payload schema, bounded content, data-only scan, response correlation, correction and retirement guards
// Rationale: each invariant returns a precise, stable reason (constraint id + non-sensitive diagnostic) so negative tests can assert the exact string — no masked violations
import type {
  Check,
  ContractResponse,
  ContractContentLimits,
  InteractionContract,
  RetirementCommand,
} from "./types";
import { COMPOUND_ACTIVITIES, PRIMITIVE_KINDS } from "./registries";
import { KIND_CONTRACT_SCHEMAS, PINNED_CONTRACT_KINDS, SUPPORTED_CONTRACT_SCHEMA_VERSIONS } from "./registries";
import { CONTRACT_CONTENT_LIMITS } from "./registries";

const FORBIDDEN_COMPONENT_KEYS: readonly string[] = ["component", "renderer", "handler", "script"];
const SCRIPT_PATTERN = /<\s*script/i;
const HTML_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const EXPRESSION_PATTERN = /\{\{|\$\{/;
const HANDLER_VALUE_PATTERN = /\bon[a-z]+\s*=/i;

export function rejectionCodeFor(reason: string): string {
  const guard = reason.indexOf(" does not hold");
  if (guard !== -1) return reason.slice(0, guard);
  const state = reason.indexOf(" cannot fire");
  if (state !== -1) return reason.slice(0, state);
  return reason;
}

function firstMissingIdentity(contract: InteractionContract): string | null {
  if (contract.interactionId.length === 0) return "missing interaction ID";
  if (contract.schemaVersion.length === 0) return "missing contract-schema version";
  if (contract.interactionRevision.length === 0) return "missing interaction revision";
  if (contract.taskId.length === 0) return "missing task ID";
  if (contract.taskRevisionPrecondition.length === 0) return "missing task revision precondition";
  return null;
}

export function contractIdentityComplete(contract: InteractionContract): Check {
  const missing = firstMissingIdentity(contract);
  if (missing) return { ok: false, reason: `contract_has_identity_and_version does not hold: ${missing}` };
  return { ok: true };
}

export function contractVersionSupported(contract: InteractionContract): Check {
  if (SUPPORTED_CONTRACT_SCHEMA_VERSIONS.includes(contract.schemaVersion)) return { ok: true };
  return {
    ok: false,
    reason:
      `contract_version_migration_explicit does not hold: contract-schema version "${contract.schemaVersion}" ` +
      "is unsupported and has no registered migration; it is never silently reinterpreted",
  };
}

export function contractKindAllowlisted(contract: InteractionContract): Check {
  if (PINNED_CONTRACT_KINDS.includes(contract.kind)) return { ok: true };
  return {
    ok: false,
    reason: `contract_kind_allowlisted does not hold: "${contract.kind}" is not a kind in the pinned host-neutral catalog`,
  };
}

export function contractDeclaresContribution(contract: InteractionContract): Check {
  const c = contract.contribution as { primitive?: string; pattern?: string; patternVersion?: string } | undefined;
  if (!c || typeof c !== "object") {
    return { ok: false, reason: "contract_declares_contribution does not hold: contract declares no contribution" };
  }
  if (typeof c.primitive === "string") {
    if (!(PRIMITIVE_KINDS as readonly string[]).includes(c.primitive)) {
      return { ok: false, reason: `contract_declares_contribution does not hold: unknown contribution primitive "${c.primitive}"` };
    }
    return { ok: true };
  }
  if (typeof c.pattern !== "string" || !(COMPOUND_ACTIVITIES as readonly string[]).includes(c.pattern)) {
    const name = typeof c.pattern === "string" ? c.pattern : String(c.pattern);
    return { ok: false, reason: `contract_declares_contribution does not hold: unknown contribution pattern "${name}"` };
  }
  if (typeof c.patternVersion !== "string" || c.patternVersion.length === 0) {
    return { ok: false, reason: "contract_declares_contribution does not hold: versioned pattern declaration requires a pattern version" };
  }
  return { ok: true };
}

export function accessibilityObligationsCarried(contract: InteractionContract): Check {
  const a = contract.accessibility as Partial<Record<string, unknown>> | undefined;
  const required = ["naming", "operation", "focusNavigation", "statusErrors", "timing"] as const;
  for (const key of required) {
    if (!a || !(key in a) || (a[key] !== null && typeof a[key] !== "string")) {
      return { ok: false, reason: `accessibility_obligations_carried does not hold: contract is missing the "${key}" obligation` };
    }
  }
  return { ok: true };
}

export function escapePathsDeclared(contract: InteractionContract): Check {
  const e = contract.escapePaths as Partial<Record<string, unknown>> | undefined;
  const required = ["reject", "defer", "cancel", "dismiss", "timeout"] as const;
  for (const key of required) {
    if (!e || typeof e[key] !== "string" || (e[key] as string).length === 0) {
      return { ok: false, reason: `escape_paths_declared does not hold: contract does not declare the "${key}" escape path` };
    }
  }
  return { ok: true };
}

function payloadShapeCheck(contract: InteractionContract): Check {
  const schema = KIND_CONTRACT_SCHEMAS[contract.kind as keyof typeof KIND_CONTRACT_SCHEMAS];
  for (const field of schema.requiredPayloadFields) {
    if (!(field in contract.payload)) {
      return { ok: false, reason: `contract_payload_valid does not hold: kind "${contract.kind}" payload is missing required field "${field}"` };
    }
    const value = contract.payload[field];
    if (typeof value !== "string" && !Array.isArray(value)) {
      return { ok: false, reason: `contract_payload_valid does not hold: kind "${contract.kind}" payload field "${field}" must be a string or array` };
    }
  }
  return { ok: true };
}

function responseSchemaCheck(contract: InteractionContract): Check {
  const rs = contract.responseSchema;
  if (!rs || !Array.isArray(rs.requiredFields)) {
    return { ok: false, reason: "contract_payload_valid does not hold: contract declares no response schema" };
  }
  if (rs.requiredFields.length === 0) {
    return { ok: false, reason: "contract_payload_valid does not hold: contract declares no required response fields" };
  }
  return { ok: true };
}

function stringLimitCheck(contract: InteractionContract, key: string, max: number, noun: string): Check {
  const value = contract.payload[key];
  if (typeof value === "string" && value.length > max) {
    return { ok: false, reason: `contract_has_bounded_content does not hold: ${noun} of ${value.length} characters exceeds the declared maximum of ${max}` };
  }
  return { ok: true };
}

function optionsLimitCheck(contract: InteractionContract, limits: ContractContentLimits): Check {
  const options = contract.payload["options"];
  if (!Array.isArray(options)) return { ok: true };
  if (options.length > limits.maxOptions) {
    return { ok: false, reason: `contract_has_bounded_content does not hold: ${options.length} options exceed the declared maximum of ${limits.maxOptions}` };
  }
  for (const option of options) {
    const value = (option as { value?: unknown })["value"];
    if (typeof value === "string" && value.length > limits.maxOptionValueLength) {
      return { ok: false, reason: `contract_has_bounded_content does not hold: option value of ${value.length} characters exceeds the declared maximum of ${limits.maxOptionValueLength}` };
    }
  }
  return { ok: true };
}

function numericLimitCheck(contract: InteractionContract, limits: ContractContentLimits): Check {
  for (const value of Object.values(contract.payload)) {
    if (typeof value === "number" && value > limits.maxNumericValue) {
      return { ok: false, reason: `contract_has_bounded_content does not hold: numeric value ${value} exceeds the declared maximum of ${limits.maxNumericValue}` };
    }
  }
  return { ok: true };
}

function payloadSizeCheck(contract: InteractionContract, limits: ContractContentLimits): Check {
  const bytes = JSON.stringify(contract.payload).length;
  if (bytes > limits.maxPayloadBytes) {
    return { ok: false, reason: `contract_has_bounded_content does not hold: payload of ${bytes} bytes exceeds the declared maximum of ${limits.maxPayloadBytes}` };
  }
  return { ok: true };
}

export function contractHasBoundedContent(contract: InteractionContract): Check {
  const limits = CONTRACT_CONTENT_LIMITS;
  const label = stringLimitCheck(contract, "label", limits.maxLabelLength, "label");
  if (!label.ok) return label;
  const description = stringLimitCheck(contract, "description", limits.maxDescriptionLength, "description");
  if (!description.ok) return description;
  const options = optionsLimitCheck(contract, limits);
  if (!options.ok) return options;
  const numeric = numericLimitCheck(contract, limits);
  if (!numeric.ok) return numeric;
  return payloadSizeCheck(contract, limits);
}

function dataOnlyValueViolation(key: string, value: string): string | null {
  if (SCRIPT_PATTERN.test(value)) return "contract_is_data_only does not hold: payload carries executable script content";
  if (HTML_PATTERN.test(value)) return "contract_is_data_only does not hold: payload carries untrusted HTML markup";
  if (EXPRESSION_PATTERN.test(value) || HANDLER_VALUE_PATTERN.test(value)) {
    return "contract_is_data_only does not hold: payload carries a host-evaluated expression";
  }
  void key;
  return null;
}

function scanEntry(key: string, value: unknown): Check {
  if (FORBIDDEN_COMPONENT_KEYS.includes(key)) {
    return { ok: false, reason: `contract_is_data_only does not hold: payload names an arbitrary component ("${key}")` };
  }
  if (/^on[a-z]+$/i.test(key) && typeof value === "string") {
    return { ok: false, reason: `contract_is_data_only does not hold: payload carries an event handler ("${key.toLowerCase()}")` };
  }
  if (typeof value === "string") {
    const violation = dataOnlyValueViolation(key, value);
    if (violation) return { ok: false, reason: violation };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = scanEntry(key, item);
      if (!nested.ok) return nested;
    }
  }
  return { ok: true };
}

export function contractIsDataOnly(contract: InteractionContract): Check {
  for (const [key, value] of Object.entries(contract.payload)) {
    const result = scanEntry(key, value);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function contractPayloadValid(contract: InteractionContract): Check {
  const checks: readonly ((c: InteractionContract) => Check)[] = [
    contractIdentityComplete,
    contractVersionSupported,
    contractKindAllowlisted,
    contractDeclaresContribution,
    accessibilityObligationsCarried,
    escapePathsDeclared,
    responseSchemaCheck,
    payloadShapeCheck,
    contractHasBoundedContent,
    contractIsDataOnly,
  ];
  for (const check of checks) {
    const result = check(contract);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function responseMismatch(response: ContractResponse, contract: InteractionContract): string | null {
  if (response.interactionId !== contract.interactionId) return "response interaction ID";
  if (response.schemaVersion !== contract.schemaVersion) return "response contract-schema version";
  if (response.interactionRevision !== contract.interactionRevision) return "response interaction revision";
  if (response.taskRevisionPrecondition !== contract.taskRevisionPrecondition) return "response task revision precondition";
  return null;
}

export function acceptResponse(contract: InteractionContract, response: ContractResponse, seenEventIds: Set<string>): Check {
  const mismatch = responseMismatch(response, contract);
  if (mismatch) {
    return { ok: false, reason: `response_correlated does not hold: ${mismatch} does not match the originating contract` };
  }
  if (typeof response.eventId !== "string" || response.eventId.length === 0) {
    return { ok: false, reason: "response_correlated does not hold: response carries no unique event ID" };
  }
  if (seenEventIds.has(response.eventId)) {
    return { ok: false, reason: `response_correlated does not hold: event ID "${response.eventId}" was already accepted` };
  }
  for (const field of contract.responseSchema.requiredFields) {
    if (!(field in response.fields)) {
      return { ok: false, reason: `response_correlated does not hold: response is missing declared field "${field}"` };
    }
  }
  seenEventIds.add(response.eventId);
  return { ok: true };
}

export function correctedContractReceived(rejected: InteractionContract, next?: InteractionContract): Check {
  if (!next) {
    return { ok: false, reason: "corrected_contract_received does not hold: no corrected contract payload was supplied" };
  }
  if (JSON.stringify(next) === JSON.stringify(rejected)) {
    return { ok: false, reason: "corrected_contract_received does not hold: the supplied contract is identical to the rejected one; a new or corrected payload is required" };
  }
  return { ok: true };
}

export function retirementRequested(command?: RetirementCommand): Check {
  if (!command) {
    return { ok: false, reason: "retirement_requested does not hold: retirement requires an explicit retire, supersede, or expiry command" };
  }
  if ("retire" in command) {
    if (typeof command.reason !== "string" || command.reason.length === 0) {
      return { ok: false, reason: "retirement_requested does not hold: an explicit retirement command requires a reason" };
    }
    return { ok: true };
  }
  if ("supersededBy" in command && command.supersededBy.length > 0) return { ok: true };
  if ("expiresAt" in command && command.expiresAt.length > 0) return { ok: true };
  const field = "supersededBy" in command ? "supersession" : "expiry";
  return { ok: false, reason: `retirement_requested does not hold: an explicit ${field} requires a ${field === "supersession" ? "superseding contract" : "time"}` };
}