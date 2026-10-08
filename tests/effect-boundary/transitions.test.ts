// Purpose: transition tests for the execution and effect boundary model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: loose reason regexes let real bypasses through; each refusal asserts the precise reason string
import { describe, it, expect } from "vitest";
import { createEffectBoundary } from "../../src/effect-boundary/machine";
import { SAFE_TEST_ENVIRONMENT } from "../../src/effect-boundary/types";
import {
  authorization,
  executorConfig,
  failureOutcome,
  partialSuccessOutcome,
  successOutcome,
  unknownOutcome,
  validIntent,
} from "./fixtures";

describe("effect-boundary transitions", () => {
  it("authorize_effect moves proposed → authorized when effect_authorization_checked holds", () => {
    const m = createEffectBoundary(validIntent(), executorConfig());
    const r = m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("authorized");
    expect(m.authorization?.approvalRecord).toBe("approval-42");
  });

  it("authorize_effect refuses an incomplete or stale authorization, naming the failed check", () => {
    const refused = (overrides: Parameters<typeof authorization>[0]): string => {
      const m = createEffectBoundary(validIntent(), executorConfig());
      const r = m.fire("authorize_effect", { kind: "authorization", authorization: authorization(overrides) });
      expect(r.ok).toBe(false);
      expect(m.state).toBe("proposed");
      if (!r.ok) return r.reason;
      throw new Error("unreachable");
    };
    expect(refused({ currentPrincipal: undefined })).toBe(
      "effect_authorization_checked does not hold: missing current principal",
    );
    expect(refused({ scope: undefined })).toBe(
      "effect_authorization_checked does not hold: missing scope",
    );
    expect(refused({ riskClass: undefined })).toBe(
      "effect_authorization_checked does not hold: missing risk class",
    );
    expect(refused({ approvalRecord: undefined })).toBe(
      "effect_authorization_checked does not hold: missing approval record",
    );
    expect(refused({ revisionPrecondition: undefined })).toBe(
      "effect_authorization_checked does not hold: missing revision precondition",
    );
    // principal is re-checked against the approval, not taken on trust
    expect(refused({ currentPrincipal: "user-2" })).toBe(
      "effect_authorization_checked does not hold: current principal user-2 does not match the approval principal user-1",
    );
    // revision preconditions are re-checked — a stale authorization does not authorize
    expect(refused({ currentRevision: "rev-8" })).toBe(
      "effect_authorization_checked does not hold: current revision rev-8 does not match precondition rev-7",
    );
  });

  it("authorize_effect requires an authorization argument", () => {
    const m = createEffectBoundary(validIntent(), executorConfig());
    const r = m.fire("authorize_effect");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("authorize_effect requires an authorization context");
    expect(m.state).toBe("proposed");
  });

  it("start_effect moves authorized → running when effects_allowlisted holds", () => {
    const m = createEffectBoundary(validIntent(), executorConfig());
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const r = m.fire("start_effect");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("running");
  });

  it("start_effect refuses unallowlisted effect types and undeclared ports", () => {
    const unlisted = createEffectBoundary(validIntent({ effectType: "email_send" }), executorConfig());
    unlisted.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const r = unlisted.fire("start_effect");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("effects_allowlisted does not hold: effect type email_send is not in the allowlist");
    }
    expect(unlisted.state).toBe("authorized");

    const sidePort = createEffectBoundary(validIntent({ port: "side-channel" }), executorConfig());
    sidePort.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const r2 = sidePort.fire("start_effect");
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason).toBe(
        "effects_allowlisted does not hold: port side-channel is not declared for effect type http_request",
      );
    }
    expect(sidePort.state).toBe("authorized");
  });

  it("complete_effect moves running → succeeded when idempotency_or_compensation_declared holds", () => {
    const m = createEffectBoundary(validIntent(), executorConfig());
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("complete_effect", { kind: "outcome", outcome: successOutcome() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("succeeded");
    expect(m.outcome?.outcome).toBe("succeeded");
  });

  it("complete_effect refuses effects that declare neither an idempotency key nor a compensation strategy", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("complete_effect", { kind: "outcome", outcome: successOutcome() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "idempotency_or_compensation_declared does not hold: the effect declares neither an idempotency key nor a compensation strategy",
      );
    }
    expect(m.state).toBe("running");
  });

  it("fail_effect moves running → failed when neither idempotency is declared nor partial failure reported", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("fail_effect", { kind: "outcome", outcome: failureOutcome() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("failed");
    expect(m.failure?.code).toBe("effect.boundary.effect_execution_failure");
  });

  it("fail_effect refuses when idempotency_or_compensation_declared or partial_failure_reported holds", () => {
    const idem = createEffectBoundary(validIntent(), executorConfig());
    idem.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    idem.fire("start_effect");
    const r = idem.fire("fail_effect", { kind: "outcome", outcome: failureOutcome() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "fail_effect guard does not hold: idempotency_or_compensation_declared holds — use complete_effect or the reconciliation path",
      );
    }
    expect(idem.state).toBe("running");

    const partial = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    partial.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    partial.fire("start_effect");
    const r2 = partial.fire("fail_effect", { kind: "outcome", outcome: partialSuccessOutcome() });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason).toBe(
        "fail_effect guard does not hold: partial_failure_reported holds — use report_partial_effect",
      );
    }
    expect(partial.state).toBe("running");
  });

  it("fail_effect requires evidence for the typed failure", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("fail_effect", { kind: "outcome", outcome: failureOutcome({ evidence: [] }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("fail_effect requires evidence for the typed failure");
    expect(m.state).toBe("running");
  });

  it("fail_effect requires an outcome record", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("fail_effect");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("fail_effect requires an outcome record");
    expect(m.state).toBe("running");
  });

  it("report_partial_effect moves running → partial when partial_failure_reported holds", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("report_partial_effect", { kind: "outcome", outcome: partialSuccessOutcome() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("partial");
    expect(m.outcome?.partialSuccess).toBe(true);
  });

  it("report_partial_effect refuses unevidenced partial success and rollback claims without succeeded compensation", () => {
    const unevidenced = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    unevidenced.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    unevidenced.fire("start_effect");
    const r = unevidenced.fire("report_partial_effect", {
      kind: "outcome",
      outcome: partialSuccessOutcome({ evidence: [] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("partial_failure_reported does not hold: partial success is not evidenced");
    }
    expect(unevidenced.state).toBe("running");

    const rollback = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    rollback.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    rollback.fire("start_effect");
    const r2 = rollback.fire("report_partial_effect", {
      kind: "outcome",
      outcome: partialSuccessOutcome({ claimsRollback: true, compensationSucceeded: false }),
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason).toBe(
        "partial_failure_reported does not hold: compensation has not succeeded — partial success cannot be reported as an atomic rollback",
      );
    }
    expect(rollback.state).toBe("running");
  });

  it("cancel_effect moves authorized → cancelled when preview_effects_isolated holds", () => {
    const preview = createEffectBoundary(validIntent({ mode: "preview" }), executorConfig());
    preview.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const r = preview.fire("cancel_effect");
    expect(r.ok).toBe(true);
    expect(preview.state).toBe("cancelled");

    // a preview effect targeting the explicitly authorized safe test environment is still isolated
    const safeTest = createEffectBoundary(
      validIntent({ mode: "shadow", environment: SAFE_TEST_ENVIRONMENT }),
      executorConfig(),
    );
    safeTest.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    expect(safeTest.fire("cancel_effect").ok).toBe(true);
    expect(safeTest.state).toBe("cancelled");
  });

  it("cancel_effect refuses live effects — the guard is preview_effects_isolated", () => {
    const m = createEffectBoundary(validIntent(), executorConfig());
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const r = m.fire("cancel_effect");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "preview_effects_isolated does not hold: the authorized effect runs live — cancellation applies only to isolated preview/shadow effects",
      );
    }
    expect(m.state).toBe("authorized");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const proposed = createEffectBoundary(validIntent(), executorConfig());
    const early = proposed.fire("start_effect");
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe("transition start_effect cannot fire from state proposed");

    const earlyComplete = proposed.fire("complete_effect");
    expect(earlyComplete.ok).toBe(false);
    if (!earlyComplete.ok) {
      expect(earlyComplete.reason).toBe("transition complete_effect cannot fire from state proposed");
    }

    const authorized = createEffectBoundary(validIntent(), executorConfig());
    authorized.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    const notRunning = authorized.fire("fail_effect", { kind: "outcome", outcome: failureOutcome() });
    expect(notRunning.ok).toBe(false);
    if (!notRunning.ok) {
      expect(notRunning.reason).toBe("transition fail_effect cannot fire from state authorized");
    }

    const running = createEffectBoundary(validIntent(), executorConfig());
    running.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    running.fire("start_effect");
    running.fire("complete_effect", { kind: "outcome", outcome: successOutcome() });
    const done = running.fire("complete_effect", { kind: "outcome", outcome: successOutcome() });
    expect(done.ok).toBe(false);
    if (!done.ok) {
      expect(done.reason).toBe("transition complete_effect cannot fire from state succeeded");
    }
  });

  it("fail_effect accepts an unknown outcome — it is not coerced to success or failure", () => {
    const m = createEffectBoundary(
      validIntent({ idempotencyKey: undefined, compensation: undefined }),
      executorConfig(),
    );
    m.fire("authorize_effect", { kind: "authorization", authorization: authorization() });
    m.fire("start_effect");
    const r = m.fire("fail_effect", { kind: "outcome", outcome: unknownOutcome() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("failed");
    expect(m.failure?.detail).toBe("acknowledgement lost after send");
  });
});
