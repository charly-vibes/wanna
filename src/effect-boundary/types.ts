// Purpose: vocabulary and record shapes for the execution and effect boundary
// Responsibilities: effect states, transition ids, effect intents, authorization contexts, executor config, outcome and failure records
// Rationale: pure decision logic returns effect intents as data; every outcome — including unknown — is an explicit record, never coerced

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type EffectState =
  | "proposed"
  | "authorized"
  | "running"
  | "succeeded"
  | "failed"
  | "partial"
  | "cancelled";

export type TransitionId =
  | "authorize_effect"
  | "start_effect"
  | "complete_effect"
  | "fail_effect"
  | "report_partial_effect"
  | "cancel_effect";

export type ExecutionMode = "live" | "preview" | "shadow";

export type Isolation = "isolated" | "safe-test" | "live";

/** The one environment a preview/shadow effect may reach when explicitly authorized. */
export const SAFE_TEST_ENVIRONMENT = "safe-test-environment";

export interface EffectIntent {
  readonly effectId: string;
  readonly effectType: string;
  readonly port: string;
  readonly mode: ExecutionMode;
  readonly mutating: boolean;
  readonly idempotencyKey?: string;
  readonly compensation?: string;
  readonly generatedCode?: string;
  readonly isolationBoundary?: string;
  readonly environment?: string;
}

export interface AuthorizationContext {
  readonly currentPrincipal?: string;
  readonly approvalPrincipal?: string;
  readonly scope?: string;
  readonly riskClass?: string;
  readonly approvalRecord?: string;
  readonly revisionPrecondition?: string;
  readonly currentRevision?: string;
}

export interface EffectPort {
  readonly effectType: string;
  readonly port: string;
}

export interface Budgets {
  readonly timeMs?: number;
  readonly resourceBytes?: number;
  readonly recursionDepth?: number;
  readonly outputBytes?: number;
  readonly retries?: number;
}

export interface ExecutorConfig {
  readonly allowlist: readonly string[];
  readonly ports: readonly EffectPort[];
  readonly budgets: Budgets;
}

export type EffectOutcome = "succeeded" | "failed" | "unknown";

export interface OutcomeRecord {
  readonly outcome: EffectOutcome;
  readonly detail: string;
  readonly evidence: readonly string[];
  readonly partialSuccess?: boolean;
  readonly claimsRollback?: boolean;
  readonly compensationSucceeded?: boolean;
  readonly reconciliationSucceeded?: boolean;
}

export interface FailureRecord {
  readonly code: "effect.boundary.effect_execution_failure";
  readonly effectId: string;
  readonly detail: string;
  readonly evidence: readonly string[];
}

export type FireArg =
  | { readonly kind: "authorization"; readonly authorization: AuthorizationContext }
  | { readonly kind: "outcome"; readonly outcome: OutcomeRecord };

export type TransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };
