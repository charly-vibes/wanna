// Purpose: transition tests for the human-authority model
// Responsibilities: every [[spec]] ## Model transition — id, from, to, guard — exercised both ways with exact failure reasons
// Rationale: loose reason regexes let real bypasses through; each refusal asserts the precise reason string
import { describe, it, expect } from "vitest";
import { createAuthorityMachine } from "../../src/human-authority/machine";
import { humanGrant, validRequest, verificationClaim } from "./fixtures";

describe("human-authority transitions", () => {
  it("request_approval moves not_required → pending when approval_scope_explicit holds", () => {
    const m = createAuthorityMachine(validRequest());
    const r = m.fire("request_approval");
    expect(r.ok).toBe(true);
    expect(m.state).toBe("pending");
  });

  it("request_approval refuses an incomplete scope, naming the missing field", () => {
    const m = createAuthorityMachine(validRequest({ reviewedRevision: "" }));
    const r = m.fire("request_approval");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("approval_scope_explicit does not hold: missing reviewed revision");
    expect(m.state).toBe("not_required");
  });

  it("grant_approval moves pending → approved when authorization_at_execution holds at the effect boundary", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    const r = m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("approved");
    expect(m.approval?.principal).toBe("user-1");
    expect(m.approval?.reviewedRevision).toBe("rev-7");
  });

  it("grant_approval refuses when the current identity does not match the approval principal", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    const r = m.fire("grant_approval", {
      kind: "authority",
      authority: humanGrant({ principal: "user-2" }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("current identity user-2 does not match the approval principal user-1");
    }
    expect(m.state).toBe("pending");
  });

  it("deny_approval moves pending → denied when authorization_at_execution does not hold", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    const r = m.fire("deny_approval", {
      kind: "authority",
      authority: verificationClaim(),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("denied");
    expect(m.denialReason).toBe(
      "verification_not_authority: authentication alone does not satisfy an authorization requirement without a separate applicable authority grant",
    );
  });

  it("deny_approval refuses when the effect is authorized — denial is not a bypass", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    const r = m.fire("deny_approval", { kind: "authority", authority: humanGrant() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "deny_approval requires authorization_at_execution not to hold — the pending effect is authorized",
      );
    }
    expect(m.state).toBe("pending");
  });

  it("expire_approval moves approved → expired once the declared expiry has lapsed", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    const r = m.fire("expire_approval", { kind: "now", now: 201 });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("expired");
  });

  it("expire_approval refuses before the expiry and when the approval carries no expiry", () => {
    const early = createAuthorityMachine(validRequest());
    early.fire("request_approval");
    early.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    const r = early.fire("expire_approval", { kind: "now", now: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("approval is not yet expired (expiry 200, now 100)");
    expect(early.state).toBe("approved");

    const noExpiry = createAuthorityMachine(
      validRequest({ expiry: undefined, invalidationConditions: ["revision-advances"] }),
    );
    noExpiry.fire("request_approval");
    noExpiry.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    const r2 = noExpiry.fire("expire_approval", { kind: "now", now: 500 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason).toBe("approval_scope_explicit does not hold: approval carries no expiry to evaluate");
    }
    expect(noExpiry.state).toBe("approved");
  });

  it("invalidate_approval moves approved → invalidated on a material change", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    const r = m.fire("invalidate_approval", {
      kind: "change",
      change: { field: "revision", permitsReuse: false },
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("invalidated");
  });

  it("invalidate_approval refuses when policy explicitly permits reuse", () => {
    const m = createAuthorityMachine(validRequest());
    m.fire("request_approval");
    m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    const r = m.fire("invalidate_approval", {
      kind: "change",
      change: { field: "target", permitsReuse: true },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(
        "approval_invalidated_on_material_change does not hold: policy explicitly permits reuse of the prior approval",
      );
    }
    expect(m.state).toBe("approved");
  });

  it("every transition refuses to fire from a state it does not originate from", () => {
    const m = createAuthorityMachine(validRequest());
    // grant_approval starts at pending, not not_required
    const r = m.fire("grant_approval", { kind: "authority", authority: humanGrant() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("transition grant_approval cannot fire from state not_required");
    expect(m.state).toBe("not_required");

    const g = createAuthorityMachine(validRequest());
    g.fire("request_approval");
    const r2 = g.fire("expire_approval", { kind: "now", now: 500 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("transition expire_approval cannot fire from state pending");
  });
});