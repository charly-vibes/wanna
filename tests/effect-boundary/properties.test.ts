// Purpose: property tests for the execution and effect boundary
// Responsibilities: each corpus property of effect-boundary as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/effect-boundary/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createEffectBoundary } from "../../src/effect-boundary/machine";
import {
  budgetsEnforced,
  effectAuthorizationChecked,
  effectsAllowlisted,
  idempotencyOrCompensationDeclared,
  makeCompensation,
  previewEffectsIsolated,
  retryAllowed,
} from "../../src/effect-boundary/invariants";
import { execute, planEffects } from "../../src/effect-boundary/executor";
import {
  SAFE_TEST_ENVIRONMENT,
  type EffectIntent,
  type OutcomeRecord,
} from "../../src/effect-boundary/types";
import {
  authorization,
  executorConfig,
  failureOutcome,
  partialSuccessOutcome,
  recordingTransport,
  successOutcome,
  unknownOutcome,
  validIntent,
} from "./fixtures";

function liveMachine(overrides: Partial<EffectIntent> = {}) {
  const m = createEffectBoundary(validIntent(overrides), executorConfig());
  m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
  m.fire("start_effect");
  return m;
}

function executeLive(overrides: Partial<EffectIntent> = {}, outcome: OutcomeRecord = successOutcome()) {
  const rec = recordingTransport(outcome);
  const result = execute(validIntent(overrides), executorConfig(), rec.transport);
  return { result, sends: rec.sends };
}

describe("effect-boundary properties", () => {
  it("TypeScript conformance test: assert invariant core_returns_effect_intents at its trust boundary and under its stated edge cases.", () => {
    // the planner returns effect intents as pure data — JSON-serializable, no
    // functions, no host handles — and consumes no I/O
    const planned = planEffects(["http_request", "file_write"]);
    expect(JSON.parse(JSON.stringify(planned))).toEqual(planned);
    for (const intent of planned) {
      for (const value of Object.values(intent)) {
        expect(typeof value).not.toBe("function");
      }
    }
    // edge cases: no decisions plan to no intents; planning is deterministic
    expect(planEffects([])).toEqual([]);
    expect(planEffects(["http_request"])).toEqual(planEffects(["http_request"]));
    // machine decisions are also plain data records
    const m = liveMachine();
    const r = m.fire("complete_effect", { kind: "outcome", outcome: successOutcome() });
    expect(Object.keys(r).sort()).toEqual(["ok"]);
    const refused = liveMachine().fire("complete_effect");
    expect(Object.keys(refused).sort()).toEqual(["ok", "reason"]);
  });

  it("TypeScript conformance test: assert invariant effects_allowlisted at its trust boundary and under its stated edge cases.", () => {
    // allowlisted type through its declared port runs
    const ok = executeLive();
    expect(ok.result.kind).toBe("executed");
    // every step of the effect path enforces the allowlist: the machine refuses
    // the start, and the executor refuses the execution, with the same precision
    const m = createEffectBoundary(validIntent({ effectType: "email_send" }), executorConfig());
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    expect(m.fire("start_effect").ok).toBe(false);
    const unlisted = effectsAllowlisted(validIntent({ effectType: "email_send" }), executorConfig());
    expect(unlisted.ok).toBe(false);
    if (!unlisted.ok) {
      expect(unlisted.reason).toBe("effects_allowlisted does not hold: effect type email_send is not in the allowlist");
    }
    // an allowlisted type through an undeclared port is refused
    const sidePort = effectsAllowlisted(validIntent({ port: "side-channel" }), executorConfig());
    expect(sidePort.ok).toBe(false);
    if (!sidePort.ok) {
      expect(sidePort.reason).toBe(
        "effects_allowlisted does not hold: port side-channel is not declared for effect type http_request",
      );
    }
    // edge case: an empty allowlist refuses every effect type
    const empty = effectsAllowlisted(validIntent(), executorConfig({ allowlist: [], ports: [] }));
    expect(empty.ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant preview_effects_isolated at its trust boundary and under its stated edge cases.", () => {
    // preview and shadow evaluation produce zero live external effects
    for (const mode of ["preview", "shadow"] as const) {
      const rec = recordingTransport(successOutcome());
      const result = execute(validIntent({ mode }), executorConfig(), rec.transport);
      expect(result.kind).toBe("executed");
      if (result.kind === "executed") {
        expect(result.record.suppressed).toBe(true);
        expect(result.record.target).toBe("(isolated — no external effects)");
      }
      expect(rec.sends).toHaveLength(0);
    }
    // with an explicitly authorized safe test environment selected, effects run
    // against that environment only — never against the live transport
    const safeRec = recordingTransport(successOutcome());
    const safe = execute(
      validIntent({ mode: "preview", environment: SAFE_TEST_ENVIRONMENT }),
      executorConfig(),
      safeRec.transport,
    );
    expect(safe.kind).toBe("executed");
    if (safe.kind === "executed") {
      expect(safe.record.suppressed).toBe(false);
      expect(safe.record.target).toBe(SAFE_TEST_ENVIRONMENT);
    }
    expect(safeRec.sends).toHaveLength(0);
    // live execution is the only path that reaches the transport
    const live = executeLive();
    expect(live.sends).toHaveLength(1);
    // the isolation classification is a pure function of the intent
    expect(previewEffectsIsolated(validIntent({ mode: "preview" }))).toBe(true);
    expect(previewEffectsIsolated(validIntent())).toBe(false);
  });

  it("TypeScript conformance test: assert invariant effect_authorization_checked at its trust boundary and under its stated edge cases.", () => {
    // a complete, matching authorization context passes
    expect(effectAuthorizationChecked(authorization()).ok).toBe(true);
    // each required field is checked, named when missing
    const missing: readonly [keyof ReturnType<typeof authorization>, string][] = [
      ["currentPrincipal", "current principal"],
      ["scope", "scope"],
      ["riskClass", "risk class"],
      ["approvalRecord", "approval record"],
      ["revisionPrecondition", "revision precondition"],
    ];
    for (const [field, what] of missing) {
      const check = effectAuthorizationChecked(authorization({ [field]: undefined }));
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.reason).toBe(`effect_authorization_checked does not hold: missing ${what}`);
      }
    }
    // the current principal must match the approval principal
    const mismatch = effectAuthorizationChecked(authorization({ currentPrincipal: "user-2" }));
    if (!mismatch.ok) {
      expect(mismatch.reason).toBe(
        "effect_authorization_checked does not hold: current principal user-2 does not match the approval principal user-1",
      );
    }
    // revision preconditions are checked immediately before the protected effect
    const stale = effectAuthorizationChecked(authorization({ currentRevision: "rev-8" }));
    if (!stale.ok) {
      expect(stale.reason).toBe(
        "effect_authorization_checked does not hold: current revision rev-8 does not match precondition rev-7",
      );
    }
  });

  it("TypeScript conformance test: assert invariant idempotency_or_compensation_declared at its trust boundary and under its stated edge cases.", () => {
    // an idempotency key or a compensation strategy satisfies the invariant
    expect(idempotencyOrCompensationDeclared(validIntent())).toBe(true);
    expect(idempotencyOrCompensationDeclared(validIntent({ idempotencyKey: undefined, compensation: "reverse-writes" }))).toBe(true);
    expect(idempotencyOrCompensationDeclared(validIntent({ idempotencyKey: undefined, compensation: undefined }))).toBe(false);
    // an empty string is not a declaration
    expect(idempotencyOrCompensationDeclared(validIntent({ idempotencyKey: "" }))).toBe(false);
    // the declaration is required before execution: the executor refuses an
    // undeclared live effect
    const undeclared = executeLive({ idempotencyKey: undefined, compensation: undefined });
    expect(undeclared.result.kind).toBe("refused");
    if (undeclared.result.kind === "refused") {
      expect(undeclared.result.reason).toBe(
        "idempotency_or_compensation_declared does not hold: the effect declares neither an idempotency key nor a compensation strategy",
      );
    }
    // and the machine refuses the success path without it
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    expect(m.fire("complete_effect", { kind: "outcome", outcome: successOutcome() }).ok).toBe(false);
    expect(m.state).toBe("running");
  });

  it("TypeScript conformance test: assert invariant timeouts_and_budgets_enforced at its trust boundary and under its stated edge cases.", () => {
    // fully declared budgets enforce execution
    const ok = executeLive();
    expect(ok.result.kind).toBe("executed");
    // each declared budget is required, named when missing
    const required: readonly [keyof ReturnType<typeof executorConfig>["budgets"], string][] = [
      ["timeMs", "no time budget declared"],
      ["resourceBytes", "no resource budget declared"],
      ["recursionDepth", "no recursion budget declared"],
      ["outputBytes", "no output-size budget declared"],
      ["retries", "no retry budget declared"],
    ];
    for (const [field, why] of required) {
      const budgets = { ...executorConfig().budgets };
      delete budgets[field];
      const check = budgetsEnforced(budgets);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.reason).toBe(`timeouts_and_budgets_enforced does not hold: ${why}`);
      }
    }
    // a non-finite budget is not an enforced budget
    const infinite = budgetsEnforced({ ...executorConfig().budgets, timeMs: Number.POSITIVE_INFINITY });
    expect(infinite.ok).toBe(false);
    // the executor refuses to run with undeclared budgets
    const rec = recordingTransport(successOutcome());
    const refused = execute(validIntent(), executorConfig({ budgets: {} }), rec.transport);
    expect(refused.kind).toBe("refused");
    expect(rec.sends).toHaveLength(0);
  });

  it("TypeScript conformance test: assert invariant untrusted_code_not_in_process at its trust boundary and under its stated edge cases.", () => {
    // model-generated code without a declared isolation boundary is refused
    const rec = recordingTransport(successOutcome());
    const refused = execute(
      validIntent({ generatedCode: "export function run() { … }" }),
      executorConfig(),
      rec.transport,
    );
    expect(refused.kind).toBe("refused");
    if (refused.kind === "refused") {
      expect(refused.reason).toBe(
        "untrusted_code_not_in_process does not hold: model-generated code would run in the trusted host process",
      );
    }
    expect(rec.sends).toHaveLength(0);
    // with a declared isolation boundary, the generated code runs behind it
    const sandboxed = executeLive({
      generatedCode: "export function run() { … }",
      isolationBoundary: "wasm-sandbox",
    });
    expect(sandboxed.result.kind).toBe("executed");
    // intents without generated code carry no isolation requirement
    expect(executeLive().result.kind).toBe("executed");
  });

  it("TypeScript conformance test: assert invariant partial_failure_reported at its trust boundary and under its stated edge cases.", () => {
    // evidenced partial success is reportable as partial — never as success
    const m = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    expect(m.fire("report_partial_effect", { kind: "outcome", outcome: partialSuccessOutcome() }).ok).toBe(true);
    expect(m.state).toBe("partial");
    expect(m.outcome?.outcome).toBe("failed");
    // unevidenced partial success is not a report
    const unevidenced = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    expect(
      unevidenced.fire("report_partial_effect", {
        kind: "outcome",
        outcome: partialSuccessOutcome({ evidence: [] }),
      }).ok,
    ).toBe(false);
    // a rollback claim without succeeded compensation is refused
    const rollback = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    expect(
      rollback.fire("report_partial_effect", {
        kind: "outcome",
        outcome: partialSuccessOutcome({ claimsRollback: true, compensationSucceeded: false }),
      }).ok,
    ).toBe(false);
    // with compensation actually succeeded, the rollback claim is representable
    const compensated = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    expect(
      compensated.fire("report_partial_effect", {
        kind: "outcome",
        outcome: partialSuccessOutcome({ claimsRollback: true, compensationSucceeded: true }),
      }).ok,
    ).toBe(true);
    expect(compensated.state).toBe("partial");
  });

  it("Fault-injection test: transport failure after send can produce unknown outcome", () => {
    // the transport double injects the fault: the request was sent, the
    // acknowledgement never came back
    const rec = recordingTransport(unknownOutcome());
    const result = execute(validIntent(), executorConfig(), rec.transport);
    expect(result.kind).toBe("executed");
    if (result.kind === "executed") {
      // the outcome is explicitly unknown — not coerced to success or failure
      expect(result.record.outcome.outcome).toBe("unknown");
      expect(result.record.outcome.detail).toBe("acknowledgement lost after send");
      expect(result.record.outcome.evidence).toEqual(["ev-ack-1"]);
    }
    expect(rec.sends).toHaveLength(1);
  });

  it("Fault-injection test: failed compensation remains visible", () => {
    // the origin effect fails
    const origin = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    origin.fire("fail_effect", { kind: "outcome", outcome: failureOutcome() });
    expect(origin.failure?.code).toBe("effect.boundary.effect_execution_failure");
    // compensation is modeled as a new effect with its own identity — not as a
    // rollback of the origin
    const comp = makeCompensation(origin.intent);
    expect(comp.effectId).toBe("effect-1-compensation");
    expect(comp.effectId).not.toBe(origin.intent.effectId);
    // it carries its own authority: it goes through its own lifecycle
    const compMachine = createEffectBoundary(comp, executorConfig());
    expect(compMachine.fire("start_effect").ok).toBe(false);
    expect(compMachine.fire("authorize_effect", { kind: "authorization", authorization: authorization() }).ok).toBe(true);
    compMachine.fire("start_effect");
    // the compensation can fail independently — and its failure stays visible
    compMachine.fire("fail_effect", { kind: "outcome", outcome: failureOutcome({ detail: "compensation write failed" }) });
    expect(compMachine.state).toBe("failed");
    expect(compMachine.failure?.detail).toBe("compensation write failed");
    // the origin failure record is unchanged and independently visible
    expect(origin.failure?.detail).toBe("connection refused");
    expect(origin.state).toBe("failed");
  });

  it("a mutating effect is retryable after uncertain outcome only with a stable idempotency key/guarantee or successful reconciliation", () => {
    const unknown = unknownOutcome();
    // with a stable idempotency key, retry is allowed
    expect(retryAllowed(validIntent(), unknown).ok).toBe(true);
    // with successful reconciliation, retry is allowed even without a key
    expect(retryAllowed(validIntent({ idempotencyKey: undefined }), { ...unknown, reconciliationSucceeded: true }).ok).toBe(true);
    // without either, an uncertain mutating effect is not retryable
    const refused = retryAllowed(validIntent({ idempotencyKey: undefined }), unknown);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe(
        "retry_requires_idempotency_or_reconciliation does not hold: the mutating effect carries no stable idempotency key and reconciliation has not succeeded",
      );
    }
    // an empty idempotency key is not a stable guarantee
    expect(retryAllowed(validIntent({ idempotencyKey: "" }), unknown).ok).toBe(false);
    // read-only effects carry no retry precondition
    expect(retryAllowed(validIntent({ mutating: false, idempotencyKey: undefined }), unknown).ok).toBe(true);
  });

  it("failure is typed ∧ evidence retained ∧ no retry without idempotency or reconciliation", () => {
    // the failure is typed and evidenced
    const m = liveMachine({ idempotencyKey: undefined, compensation: undefined });
    const r = m.fire("fail_effect", { kind: "outcome", outcome: failureOutcome() });
    expect(r.ok).toBe(true);
    expect(m.failure).toEqual({
      code: "effect.boundary.effect_execution_failure",
      effectId: "effect-1",
      detail: "connection refused",
      evidence: ["ev-2"],
    });
    // a failed mutating effect is not retried without idempotency or reconciliation
    const failed: OutcomeRecord = { outcome: "failed", detail: "connection refused", evidence: ["ev-2"] };
    const noIdem = retryAllowed(validIntent({ idempotencyKey: undefined }), failed);
    expect(noIdem.ok).toBe(false);
    if (!noIdem.ok) {
      expect(noIdem.reason).toBe(
        "retry_requires_idempotency_or_reconciliation does not hold: the mutating effect carries no stable idempotency key and reconciliation has not succeeded",
      );
    }
    // with a stable idempotency key, or succeeded reconciliation, retry is allowed
    expect(retryAllowed(validIntent(), failed).ok).toBe(true);
    expect(retryAllowed(validIntent({ idempotencyKey: undefined }), { ...failed, reconciliationSucceeded: true }).ok).toBe(true);
  });
});
