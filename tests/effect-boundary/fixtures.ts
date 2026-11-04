// Purpose: test fixtures for the execution and effect boundary
// Responsibilities: build canonical valid intents, executor configs, authorization contexts, and outcome records the corpus properties name
// Rationale: single source of shared effect vocabulary for transitions and properties tests
import type {
  AuthorizationContext,
  EffectIntent,
  ExecutorConfig,
  OutcomeRecord,
} from "../../src/effect-boundary/types";
import { SAFE_TEST_ENVIRONMENT } from "../../src/effect-boundary/types";
import type { EffectTransport } from "../../src/effect-boundary/executor";

export { SAFE_TEST_ENVIRONMENT };

export function validIntent(overrides: Partial<EffectIntent> = {}): EffectIntent {
  return {
    effectId: "effect-1",
    effectType: "http_request",
    port: "http-primary",
    mode: "live",
    mutating: true,
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

export function executorConfig(overrides: Partial<ExecutorConfig> = {}): ExecutorConfig {
  return {
    allowlist: ["http_request", "file_write", "deploy", "compensation"],
    ports: [
      { effectType: "http_request", port: "http-primary" },
      { effectType: "file_write", port: "fs-primary" },
      { effectType: "deploy", port: "deploy-primary" },
      { effectType: "compensation", port: "compensation-primary" },
    ],
    budgets: {
      timeMs: 1000,
      resourceBytes: 1048576,
      recursionDepth: 32,
      outputBytes: 65536,
      retries: 2,
    },
    ...overrides,
  };
}

/** Shallow-override merge for context records. */
function contextWith<T>(base: T, overrides: Partial<T>): T {
  return Object.assign({}, base, overrides);
}

export function authorization(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return contextWith(
    {
      currentPrincipal: "user-1",
      approvalPrincipal: "user-1",
      scope: "deploy://staging",
      riskClass: "high",
      approvalRecord: "approval-42",
      revisionPrecondition: "rev-7",
      currentRevision: "rev-7",
    },
    overrides,
  );
}

/** Independent-copy merge for outcome records (deep-copies the base first). */
function cloneWith<T extends object>(base: T, overrides: Partial<T>): T {
  return Object.assign(structuredClone(base), overrides) as T;
}

export function successOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return contextWith(
    { outcome: "succeeded", detail: "effect completed", evidence: ["ev-1"] },
    overrides,
  );
}

export function failureOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return cloneWith(
    { outcome: "failed", detail: "connection refused", evidence: ["ev-2"] },
    overrides,
  );
}

export function partialSuccessOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return Object.assign(
    {
      outcome: "failed",
      detail: "wrote 3 of 5 records before the link dropped",
      evidence: ["ev-p1"],
      partialSuccess: true,
    },
    overrides,
  );
}

export function unknownOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return cloneWith(
    { outcome: "unknown", detail: "acknowledgement lost after send", evidence: ["ev-ack-1"] },
    overrides,
  );
}

export interface RecordingTransport {
  readonly sends: EffectIntent[];
  readonly transport: EffectTransport;
}

export function recordingTransport(outcome: OutcomeRecord): RecordingTransport {
  const sends: EffectIntent[] = [];
  const transport = transportOf(sends, outcome);
  return { sends, transport };
}

function transportOf(sends: EffectIntent[], outcome: OutcomeRecord): EffectTransport {
  return Object.freeze({
    send: (intent: EffectIntent) => {
      sends.push(intent);
      return outcome;
    },
  });
}
