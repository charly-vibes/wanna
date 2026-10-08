// Purpose: property tests for the human-authority layer
// Responsibilities: each corpus property of human-authority as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/human-authority/*.toml to these tests via `vitest run -t '<description>'`
import { describe, it, expect } from "vitest";
import { createAuthorityMachine } from "../../src/human-authority/machine";
import {
  approvalScopeExplicit,
  authorizationAtExecution,
  AUTHORITY_LAYER_VERSION,
} from "../../src/human-authority/invariants";
import { automationGrant, humanGrant, validRequest, verificationClaim } from "./fixtures";
import type { MaterialChange } from "../../src/human-authority/types";

function grantThrough(
  overrides: Partial<Parameters<typeof validRequest>[0]> = {},
  authority = humanGrant(),
) {
  const m = createAuthorityMachine(validRequest(overrides));
  const request = m.fire("request_approval");
  const grant = m.fire("grant_approval", { kind: "authority", authority });
  return { m, request, grant };
}

describe("human-authority properties", () => {
  it(
    "TypeScript conformance test: assert invariant approval_scope_explicit at its trust boundary " +
      "and under its stated edge cases.",
    () => {
      // canonical operation: a fully-scoped request satisfies the invariant
      expect(approvalScopeExplicit(validRequest()).ok).toBe(true);
      // trust boundary: the request_approval guard consults the invariant — an
      // incomplete scope never reaches pending
      for (const [overrides, reason] of [
        [{ principal: "" }, "approval_scope_explicit does not hold: missing principal"],
        [{ action: "" }, "approval_scope_explicit does not hold: missing action"],
        [{ resourceScope: "" }, "approval_scope_explicit does not hold: missing resource scope"],
        [{ riskClass: "extreme" as never }, "approval_scope_explicit does not hold: unsupported risk class: extreme"],
        [{ reviewedRevision: "" }, "approval_scope_explicit does not hold: missing reviewed revision"],
        [
          { expiry: undefined, invalidationConditions: [] },
          "approval_scope_explicit does not hold: approval has neither expiry nor invalidation conditions",
        ],
      ] as const) {
        const check = approvalScopeExplicit(validRequest({ ...overrides }));
        expect(check.ok).toBe(false);
        if (!check.ok) expect(check.reason).toBe(reason);
        const m = createAuthorityMachine(validRequest({ ...overrides }));
        const r = m.fire("request_approval");
        expect(r.ok).toBe(false);
        expect(m.state).toBe("not_required");
      }
      // edge cases: expiry-only and conditions-only requests both satisfy the invariant
      expect(approvalScopeExplicit(validRequest({ invalidationConditions: [] })).ok).toBe(true);
      expect(approvalScopeExplicit(validRequest({ expiry: undefined })).ok).toBe(true);
    },
  );

  it(
    "TypeScript conformance test: assert invariant authorization_at_execution at its trust boundary " +
      "and under its stated edge cases.",
    () => {
      // canonical operation: a matching grant authorizes at the execution boundary
      expect(authorizationAtExecution(validRequest(), humanGrant()).ok).toBe(true);
      const { m, grant } = grantThrough();
      expect(grant.ok).toBe(true);
      expect(m.state).toBe("approved");
      // every drifted precondition is refused with a precise reason at the boundary
      for (const [authority, reason] of [
        [humanGrant({ principal: "user-2" }), "current identity user-2 does not match the approval principal user-1"],
        [humanGrant({ action: "read:file" }), "authority does not cover the requested action: read:file vs write:file"],
        [
          humanGrant({ resource: "repo:infra" }),
          "authority scope repo:infra does not match the approval resource scope repo:app",
        ],
        [humanGrant({ revision: "rev-6" }), "authority revision rev-6 does not match the reviewed revision rev-7"],
        [
          humanGrant({ policyVersion: "policy-2" }),
          "authority policy version policy-2 does not match the request policy version policy-3",
        ],
      ] as const) {
        const check = authorizationAtExecution(validRequest(), authority);
        expect(check.ok).toBe(false);
        if (!check.ok) expect(check.reason).toBe(reason);
        const g = createAuthorityMachine(validRequest());
        g.fire("request_approval");
        expect(g.fire("grant_approval", { kind: "authority", authority }).ok).toBe(false);
      }
    },
  );

  it(
    "TypeScript conformance test: assert invariant approval_invalidated_on_material_change at its trust " +
      "boundary and under its stated edge cases.",
    () => {
      // each material field invalidates the approval at the boundary
      for (const field of ["action", "target", "evidence", "revision"] as const) {
        const { m } = grantThrough();
        const r = m.fire("invalidate_approval", { kind: "change", change: { field, permitsReuse: false } });
        expect(r.ok).toBe(true);
        expect(m.state).toBe("invalidated");
      }
      // edge case: policy permitting reuse keeps the approval alive
      const reuse = grantThrough();
      const r2 = reuse.m.fire("invalidate_approval", {
        kind: "change",
        change: { field: "revision", permitsReuse: true } satisfies MaterialChange,
      });
      expect(r2.ok).toBe(false);
      expect(reuse.m.state).toBe("approved");
      // edge case: a non-material field never invalidates
      const immaterial = grantThrough();
      const r3 = immaterial.m.fire("invalidate_approval", {
        kind: "change",
        change: { field: "cosmetics", permitsReuse: false } as unknown as MaterialChange,
      });
      expect(r3.ok).toBe(false);
      if (!r3.ok) {
        expect(r3.reason).toBe(
          "approval_invalidated_on_material_change does not hold: cosmetics is not a material change field",
        );
      }
      expect(immaterial.m.state).toBe("approved");
    },
  );

  it(
    "TypeScript conformance test: assert invariant model_cannot_self_approve at its trust boundary " +
      "and under its stated edge cases.",
    () => {
      // a model requester cannot satisfy the human-authority requirement
      const modelCheck = authorizationAtExecution(validRequest(), humanGrant({ grantedBy: "model" }));
      expect(modelCheck.ok).toBe(false);
      if (!modelCheck.ok) {
        expect(modelCheck.reason).toBe(
          "model_cannot_self_approve: a model-generated proposal or confidence score cannot satisfy a required human or external authority requirement",
        );
      }
      const m = createAuthorityMachine(validRequest());
      m.fire("request_approval");
      expect(m.fire("grant_approval", { kind: "authority", authority: humanGrant({ grantedBy: "model" }) }).ok).toBe(
        false,
      );
      expect(m.state).toBe("pending");
      // a model confidence score alone cannot approve either
      const confidence = authorizationAtExecution(
        validRequest(),
        verificationClaim({ basis: "model_confidence", confidence: 0.99 }),
      );
      expect(confidence.ok).toBe(false);
      if (!confidence.ok) {
        expect(confidence.reason).toBe(
          "verification_not_authority: model_confidence alone does not satisfy an authorization requirement without a separate applicable authority grant",
        );
      }
      // edge case: model confidence on the request is advisory and does not block a human grant
      const { grant } = grantThrough({ confidence: 0.99 });
      expect(grant.ok).toBe(true);
    },
  );

  it(
    "TypeScript conformance test: assert invariant denial_is_terminal_for_attempt at its trust boundary " +
      "and under its stated edge cases.",
    () => {
      const m = createAuthorityMachine(validRequest());
      m.fire("request_approval");
      m.fire("deny_approval", { kind: "authority", authority: verificationClaim() });
      expect(m.state).toBe("denied");
      // the denied attempt cannot be re-fired as authorized: no transition leaves denied
      const r = m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("transition grant_approval cannot fire from state denied");
      // an unchanged request cannot retry either
      const retry = m.retryWith(validRequest());
      expect(retry.ok).toBe(false);
      if (!retry.ok) {
        expect(retry.reason).toBe(
          "denial_is_terminal_for_attempt does not hold: the retried request is unchanged under policy — a new approval or a changed request is required",
        );
      }
      expect(m.state).toBe("denied");
      // edge case: a changed request may begin a new approval attempt
      const changed = m.retryWith(validRequest({ reviewedRevision: "rev-8" }));
      expect(changed.ok).toBe(true);
      expect(m.state).toBe("pending");
      // edge case: retry is only meaningful from denied
      const m2 = createAuthorityMachine(validRequest());
      m2.fire("request_approval");
      const r2 = m2.retryWith(validRequest({ reviewedRevision: "rev-8" }));
      expect(r2.ok).toBe(false);
      if (!r2.ok) {
        expect(r2.reason).toBe(
          "denial_is_terminal_for_attempt does not hold: no denied attempt is pending (state is pending)",
        );
      }
    },
  );

  it(
    "TypeScript conformance test: assert invariant approval_audited at its trust boundary and under its " +
      "stated edge cases.",
    () => {
      const m = createAuthorityMachine(validRequest());
      m.fire("request_approval");
      m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
      m.fire("expire_approval", { kind: "now", now: 201 });
      // every outcome is audited with sufficient provenance
      const outcomes = m.audit.map((a) => a.outcome);
      expect(outcomes).toEqual(["requested", "granted", "expired"]);
      for (const record of m.audit) {
        expect(record.requestId).toBe("req-1");
        expect(record.principal).toBe("user-1");
        expect(record.action).toBe("write:file");
        expect(record.recordedBy).toBe(AUTHORITY_LAYER_VERSION);
      }
      // refusals are audited too, naming the reason
      const refused = createAuthorityMachine(validRequest({ principal: "" }));
      refused.fire("request_approval");
      expect(refused.audit).toHaveLength(1);
      expect(refused.audit[0]?.outcome).toBe("refused");
      expect(refused.audit[0]?.reason).toBe("approval_scope_explicit does not hold: missing principal");
      // minimization: the audit trail carries no confidence values or evidence payloads
      const noisy = createAuthorityMachine(validRequest({ confidence: 0.42 }));
      noisy.fire("request_approval");
      noisy.fire("grant_approval", { kind: "authority", authority: humanGrant() });
      const serialized = JSON.stringify(noisy.audit).toLowerCase();
      expect(serialized).not.toContain("confidence");
      expect(serialized).not.toContain("0.42");
    },
  );

  it("Policy test: bounded unattended automation can proceed only inside an explicit grant", () => {
    // inside the explicit grant: bounded automation authorizes
    const inside = authorizationAtExecution(validRequest(), automationGrant());
    expect(inside.ok).toBe(true);
    const { m, grant } = grantThrough({}, automationGrant());
    expect(grant.ok).toBe(true);
    expect(m.state).toBe("approved");
    // outside the grant: an exhausted bounded grant authorizes nothing
    const exhausted = authorizationAtExecution(validRequest(), automationGrant({ usesRemaining: 0 }));
    expect(exhausted.ok).toBe(false);
    if (!exhausted.ok) expect(exhausted.reason).toBe("bounded automation grant is exhausted (0 of 3 uses remaining)");
    // outside the grant: an out-of-scope action authorizes nothing
    const outOfScope = authorizationAtExecution(validRequest(), automationGrant({ action: "read:file" }));
    expect(outOfScope.ok).toBe(false);
    if (!outOfScope.ok) {
      expect(outOfScope.reason).toBe("authority does not cover the requested action: read:file vs write:file");
    }
    // no explicit grant at all (an unverifiable claim): nothing proceeds
    const none = authorizationAtExecution(validRequest(), verificationClaim({ basis: "acknowledgement" }));
    expect(none.ok).toBe(false);
  });

  it("Security test: authentication success alone cannot approve pending protected effect", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    const r = m.fire("grant_approval", { kind: "authority", authority: verificationClaim() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "verification_not_authority: authentication alone does not satisfy an authorization requirement without a separate applicable authority grant",
      );
    }
    expect(m.state).toBe("pending");
    expect(m.approval).toBeNull();
    // each verification-class basis fails the same way
    for (const basis of ["authentication", "verification", "acknowledgement", "recommendation", "model_confidence"] as const) {
      const check = authorizationAtExecution(validRequest(), verificationClaim({ basis }));
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.reason).toBe(
          `verification_not_authority: ${basis} alone does not satisfy an authorization requirement without a separate applicable authority grant`,
        );
      }
    }
    // edge case: with a separate applicable authority grant, the protected effect approves
    const withGrant = authorizationAtExecution(validRequest(), humanGrant());
    expect(withGrant.ok).toBe(true);
    const m2 = createAuthorityMachine(validRequest());
    m2.fire("request_approval");
    expect(m2.fire("grant_approval", { kind: "authority", authority: humanGrant() }).ok).toBe(true);
    expect(m2.state).toBe("approved");
  });
});