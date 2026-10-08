// Purpose: trusted registries and runtime validation for the interaction catalog
// Responsibilities: trusted renderers, pinned kind sets, registered migrations, runtime response validators, option-id resolution, authorize binding
// Rationale: every registry is a closed allowlist — unknown names are refused with precise reasons, never resolved dynamically
import type {
  AuthorizeContract,
  AuthorizeContractInput,
  AuthorizeDecisionInput,
  Check,
  InteractionKind,
  KindDefinition,
  MigrateResult,
  OptionSpec,
  ResponseRecord,
} from "./types";
import { INTERACTION_KINDS } from "./types";
import { contentHash } from "./hash";

export const CATALOG_VERSION_V1 = "interaction-catalog-1.0.0";

export const TRUSTED_RENDERERS: readonly string[] = [
  "host:clarify-form", "host:choice-list", "host:rank-list", "host:field-editor",
  "host:artifact-review", "host:evidence-panel", "host:claim-check", "host:authorize-consent",
];

export const CATALOG_KIND_SETS: Record<string, readonly InteractionKind[]> = {
  [CATALOG_VERSION_V1]: INTERACTION_KINDS,
};

export const REGISTERED_MIGRATIONS: Record<string, { from: string; to: string }> = {
  "migrate-v1-to-v2": { from: CATALOG_VERSION_V1, to: "interaction-catalog-2.0.0" },
};

export function migrateContract(contract: { readonly version: string }, migrationName: string): MigrateResult {
  const migration = REGISTERED_MIGRATIONS[migrationName];
  if (!migration) {
    return {
      ok: false,
      reason: `catalog_retirement_explicit does not hold: no registered migration "${migrationName}"; active contracts must be retired and reissued`,
    };
  }
  if (contract.version !== migration.from) {
    return { ok: false, reason: `registered migration "${migrationName}" applies to version "${migration.from}", not "${contract.version}"` };
  }
  return { ok: true, version: migration.to };
}

function outcomeCheck(kindDef: KindDefinition, response: ResponseRecord): Check {
  const outcome = response.fields["outcome"];
  if (outcome === undefined) {
    return { ok: false, reason: `kind "${kindDef.kind}" response declares no outcome` };
  }
  if (!kindDef.outcomes.includes(outcome as string)) {
    return { ok: false, reason: `outcome "${String(outcome)}" is not in the declared outcome vocabulary for kind "${kindDef.kind}"` };
  }
  return { ok: true };
}

function requiredCheck(kindDef: KindDefinition, response: ResponseRecord): Check {
  for (const field of kindDef.requiredFields) {
    if (response.fields[field] === undefined) {
      return { ok: false, reason: `kind "${kindDef.kind}" response missing required field "${field}"` };
    }
  }
  return { ok: true };
}

function payloadSizeCheck(kindDef: KindDefinition, response: ResponseRecord): Check {
  const bytes = JSON.stringify(response.fields).length;
  if (bytes > kindDef.bounds.maxPayloadBytes) {
    return {
      ok: false,
      reason: `bounds violation for kind "${kindDef.kind}": payload of ${bytes} bytes exceeds the declared maximum of ${kindDef.bounds.maxPayloadBytes}`,
    };
  }
  return { ok: true };
}

function fieldBoundsCheck(kindDef: KindDefinition, response: ResponseRecord): Check {
  for (const [name, value] of Object.entries(response.fields)) {
    if (Array.isArray(value) && kindDef.bounds.maxOptions !== undefined && value.length > kindDef.bounds.maxOptions) {
      return {
        ok: false,
        reason: `bounds violation for kind "${kindDef.kind}": ${value.length} options exceed the declared maximum of ${kindDef.bounds.maxOptions}`,
      };
    }
    if (typeof value === "string" && value.length > kindDef.bounds.maxStringLength) {
      return {
        ok: false,
        reason: `bounds violation for kind "${kindDef.kind}": field "${name}" exceeds the declared maximum string length of ${kindDef.bounds.maxStringLength}`,
      };
    }
  }
  return { ok: true };
}

function depthOf(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  const values = Object.values(value);
  return 1 + Math.max(0, ...values.map(depthOf));
}

function nestingCheck(kindDef: KindDefinition, response: ResponseRecord): Check {
  if (depthOf(response.fields) > kindDef.bounds.maxNesting) {
    return {
      ok: false,
      reason: `bounds violation for kind "${kindDef.kind}": payload nesting exceeds the declared maximum of ${kindDef.bounds.maxNesting}`,
    };
  }
  return { ok: true };
}

type ResponseValidator = (kindDef: KindDefinition, response: ResponseRecord) => Check;

const BASE_CHECKS: readonly ResponseValidator[] = [
  outcomeCheck,
  requiredCheck,
  payloadSizeCheck,
  fieldBoundsCheck,
  nestingCheck,
];

function baseValidator(kindDef: KindDefinition, response: ResponseRecord): Check {
  for (const check of BASE_CHECKS) {
    const result = check(kindDef, response);
    if (!result.ok) return result;
  }
  return { ok: true };
}

function rankValidator(kindDef: KindDefinition, response: ResponseRecord): Check {
  const base = baseValidator(kindDef, response);
  if (!base.ok) return base;
  const order = response.fields["order"];
  if (Array.isArray(order) && new Set(order).size !== order.length) {
    return { ok: false, reason: "rank response contains duplicate option IDs" };
  }
  return { ok: true };
}

export const RUNTIME_VALIDATORS: Record<InteractionKind, ResponseValidator> = {
  clarify: baseValidator,
  choose: baseValidator,
  rank: rankValidator,
  configure: baseValidator,
  review: baseValidator,
  diagnose: baseValidator,
  verify: baseValidator,
  authorize: baseValidator,
};

export function validateResponse(kindDef: KindDefinition, response: ResponseRecord): Check {
  return RUNTIME_VALIDATORS[kindDef.kind](kindDef, response);
}

export function resolveOptionReferences(options: readonly OptionSpec[], refs: readonly string[]): Check {
  for (const ref of refs) {
    if (options.some((o) => o.id === ref)) continue;
    if (options.some((o) => o.label === ref)) {
      return { ok: false, reason: `response_uses_stable_option_ids does not hold: "${ref}" is a display label, not a stable option ID` };
    }
    return { ok: false, reason: `response_uses_stable_option_ids does not hold: "${ref}" is not a known stable option ID` };
  }
  return { ok: true };
}

export function resolveRenderer(name: string): { ok: true; renderer: string } | { ok: false; reason: string } {
  if (TRUSTED_RENDERERS.includes(name)) return { ok: true, renderer: name };
  return { ok: false, reason: `host_renderer_trusted does not hold: "${name}" is not a registered trusted renderer` };
}

export function createAuthorizeContract(input: AuthorizeContractInput): AuthorizeContract {
  return { ...input, bindingHash: contentHash(input) };
}

export function authorizeDecision(contract: AuthorizeContract, decision: AuthorizeDecisionInput): Check {
  if (decision.action !== contract.action) {
    return { ok: false, reason: `authorization_scope_bound does not hold: decision action "${decision.action}" does not match contracted action "${contract.action}"` };
  }
  if (decision.taskRevision !== contract.taskRevision) {
    return { ok: false, reason: `authorization_scope_bound does not hold: decision task revision "${decision.taskRevision}" does not match contracted revision "${contract.taskRevision}"` };
  }
  if (decision.actor !== contract.actor) {
    return { ok: false, reason: `authorization_scope_bound does not hold: decision actor "${decision.actor}" does not match contracted actor "${contract.actor}"` };
  }
  if (decision.expiry !== contract.expiry) {
    return { ok: false, reason: `authorization_scope_bound does not hold: decision expiry "${decision.expiry}" does not match contracted expiry "${contract.expiry}"` };
  }
  return { ok: true };
}