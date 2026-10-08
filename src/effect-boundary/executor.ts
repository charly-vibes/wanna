// Purpose: the trusted executor behind the effect boundary
// Responsibilities: allowlist/budget/idempotency/isolation preconditions, preview/shadow suppression, safe-test routing, live transport dispatch, and the pure effect planner
// Rationale: core logic produces effect intents as data; only this trusted executor performs approved effects, through an injected transport so the module itself performs no I/O
import type { EffectIntent, ExecutorConfig, OutcomeRecord } from "./types";
import { SAFE_TEST_ENVIRONMENT } from "./types";
import {
  budgetsEnforced,
  effectsAllowlisted,
  idempotencyOrCompensationDeclared,
  isolationOf,
  untrustedCodeIsolated,
} from "./invariants";

export { SAFE_TEST_ENVIRONMENT };

export const ISOLATED_TARGET = "(isolated — no external effects)";
export const LIVE_TARGET = "live";

export interface EffectTransport {
  send(intent: EffectIntent): OutcomeRecord;
}

export interface ExecutionRecord {
  readonly intent: EffectIntent;
  readonly target: string;
  readonly suppressed: boolean;
  readonly outcome: OutcomeRecord;
}

export type ExecutionResult =
  | { readonly kind: "executed"; readonly record: ExecutionRecord }
  | { readonly kind: "refused"; readonly reason: string };

function runIsolated(intent: EffectIntent): ExecutionResult {
  return {
    kind: "executed",
    record: {
      intent,
      target: ISOLATED_TARGET,
      suppressed: true,
      outcome: {
        outcome: "succeeded",
        detail: "suppressed by preview/shadow isolation",
        evidence: [],
      },
    },
  };
}

function runSafeTest(intent: EffectIntent): ExecutionResult {
  const target = intent.environment ?? SAFE_TEST_ENVIRONMENT;
  return {
    kind: "executed",
    record: {
      intent,
      target,
      suppressed: false,
      outcome: {
        outcome: "succeeded",
        detail: `executed against the authorized safe test environment ${target}`,
        evidence: [],
      },
    },
  };
}

function runLive(intent: EffectIntent, transport: EffectTransport): ExecutionResult {
  return {
    kind: "executed",
    record: {
      intent,
      target: LIVE_TARGET,
      suppressed: false,
      outcome: transport.send(intent),
    },
  };
}

export function execute(
  intent: EffectIntent,
  config: ExecutorConfig,
  transport: EffectTransport,
): ExecutionResult {
  const allow = effectsAllowlisted(intent, config);
  if (!allow.ok) return { kind: "refused", reason: allow.reason };
  const budgets = budgetsEnforced(config.budgets);
  if (!budgets.ok) return { kind: "refused", reason: budgets.reason };
  if (isolationOf(intent) === "live" && !idempotencyOrCompensationDeclared(intent)) {
    return {
      kind: "refused",
      reason: "idempotency_or_compensation_declared does not hold: the effect declares neither an idempotency key nor a compensation strategy",
    };
  }
  const code = untrustedCodeIsolated(intent);
  if (!code.ok) return { kind: "refused", reason: code.reason };
  const isolation = isolationOf(intent);
  if (isolation === "isolated") return runIsolated(intent);
  if (isolation === "safe-test") return runSafeTest(intent);
  return runLive(intent, transport);
}

export function planEffects(decisions: readonly string[]): readonly EffectIntent[] {
  return decisions.map((effectType, index) => ({
    effectId: `planned-${index + 1}`,
    effectType,
    port: `port-for-${effectType}`,
    mode: "live" as const,
    mutating: true,
  }));
}
