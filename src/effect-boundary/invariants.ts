// Purpose: invariants for the execution and effect boundary
// Responsibilities: authorization check, effect allowlist, idempotency/compensation declaration, partial-failure reporting, preview isolation, untrusted-code isolation, budget enforcement, retry precondition, failure typing, compensation construction
// Rationale: each invariant returns a precise failure reason so negative tests can assert it and bypasses cannot hide behind vague refusals
import type {
  AuthorizationContext,
  Budgets,
  Check,
  EffectIntent,
  ExecutorConfig,
  FailureRecord,
  Isolation,
  OutcomeRecord,
} from "./types";
import { SAFE_TEST_ENVIRONMENT } from "./types";

export { SAFE_TEST_ENVIRONMENT };

function isBlank(value: string | undefined): boolean {
  return typeof value !== "string" || value.length === 0;
}

export function effectAuthorizationChecked(auth: AuthorizationContext): Check {
  const required: readonly [string | undefined, string][] = [
    [auth.currentPrincipal, "current principal"],
    [auth.scope, "scope"],
    [auth.riskClass, "risk class"],
    [auth.approvalRecord, "approval record"],
    [auth.revisionPrecondition, "revision precondition"],
    [auth.currentRevision, "current revision"],
  ];
  for (const [value, what] of required) {
    if (isBlank(value)) {
      return { ok: false, reason: `effect_authorization_checked does not hold: missing ${what}` };
    }
  }
  if (auth.currentPrincipal !== auth.approvalPrincipal) {
    return {
      ok: false,
      reason: `effect_authorization_checked does not hold: current principal ${auth.currentPrincipal} does not match the approval principal ${auth.approvalPrincipal}`,
    };
  }
  if (auth.currentRevision !== auth.revisionPrecondition) {
    return {
      ok: false,
      reason: `effect_authorization_checked does not hold: current revision ${auth.currentRevision} does not match precondition ${auth.revisionPrecondition}`,
    };
  }
  return { ok: true };
}

export function effectsAllowlisted(intent: EffectIntent, config: ExecutorConfig): Check {
  if (!(config.allowlist as readonly string[]).includes(intent.effectType)) {
    return {
      ok: false,
      reason: `effects_allowlisted does not hold: effect type ${intent.effectType} is not in the allowlist`,
    };
  }
  const declared = config.ports.some(
    (p) => p.effectType === intent.effectType && p.port === intent.port,
  );
  if (!declared) {
    return {
      ok: false,
      reason: `effects_allowlisted does not hold: port ${intent.port} is not declared for effect type ${intent.effectType}`,
    };
  }
  return { ok: true };
}

export function idempotencyOrCompensationDeclared(intent: EffectIntent): boolean {
  return !isBlank(intent.idempotencyKey) || !isBlank(intent.compensation);
}

export function partialFailureReported(outcome: OutcomeRecord): Check {
  if (outcome.partialSuccess !== true) {
    return {
      ok: false,
      reason: "partial_failure_reported does not hold: the outcome is not a partial-success report",
    };
  }
  if (outcome.evidence.length === 0) {
    return {
      ok: false,
      reason: "partial_failure_reported does not hold: partial success is not evidenced",
    };
  }
  if (outcome.claimsRollback === true && outcome.compensationSucceeded !== true) {
    return {
      ok: false,
      reason: "partial_failure_reported does not hold: compensation has not succeeded — partial success cannot be reported as an atomic rollback",
    };
  }
  return { ok: true };
}

export function isolationOf(intent: EffectIntent): Isolation {
  if (intent.mode === "live") return "live";
  return intent.environment === SAFE_TEST_ENVIRONMENT ? "safe-test" : "isolated";
}

export function previewEffectsIsolated(intent: EffectIntent): boolean {
  return isolationOf(intent) !== "live";
}

export function untrustedCodeIsolated(intent: EffectIntent): Check {
  if (intent.generatedCode === undefined) return { ok: true };
  if (isBlank(intent.isolationBoundary)) {
    return {
      ok: false,
      reason: "untrusted_code_not_in_process does not hold: model-generated code would run in the trusted host process",
    };
  }
  return { ok: true };
}

const BUDGET_FIELDS: readonly [keyof Budgets, string][] = [
  ["timeMs", "no time budget declared"],
  ["resourceBytes", "no resource budget declared"],
  ["recursionDepth", "no recursion budget declared"],
  ["outputBytes", "no output-size budget declared"],
  ["retries", "no retry budget declared"],
];

export function budgetsEnforced(budgets: Budgets): Check {
  for (const [field, why] of BUDGET_FIELDS) {
    const value = budgets[field];
    if (value === undefined) {
      return { ok: false, reason: `timeouts_and_budgets_enforced does not hold: ${why}` };
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return {
        ok: false,
        reason: `timeouts_and_budgets_enforced does not hold: ${field} is not a finite non-negative number`,
      };
    }
  }
  return { ok: true };
}

export function retryAllowed(intent: EffectIntent, outcome: OutcomeRecord): Check {
  if (!intent.mutating) return { ok: true };
  if (outcome.outcome !== "unknown" && outcome.outcome !== "failed") return { ok: true };
  if (!isBlank(intent.idempotencyKey) || outcome.reconciliationSucceeded === true) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: "retry_requires_idempotency_or_reconciliation does not hold: the mutating effect carries no stable idempotency key and reconciliation has not succeeded",
  };
}

export function recordFailure(intent: EffectIntent, outcome: OutcomeRecord): FailureRecord {
  return {
    code: "effect.boundary.effect_execution_failure",
    effectId: intent.effectId,
    detail: outcome.detail,
    evidence: [...outcome.evidence],
  };
}

// Compensation is modeled as a new effect — not as rollback of the origin — so it
// carries its own identity and its own (absent) idempotency/compensation
// declaration: it can succeed, fail, or remain unknown independently.
export function makeCompensation(origin: EffectIntent): EffectIntent {
  return {
    effectId: `${origin.effectId}-compensation`,
    effectType: "compensation",
    port: "compensation-primary",
    mode: origin.mode,
    mutating: true,
  };
}
