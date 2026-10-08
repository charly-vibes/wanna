// Purpose: property tests for the interaction-security validation pipeline
// Responsibilities: the catalog/size/rendering/authorization properties as vitest tests; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-security/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createSecurityGate } from "../../src/interaction-security/machine";
import {
  escapeText,
  hostAuthorizes,
} from "../../src/interaction-security/policy";
import { payloadPassesSecurityValidation } from "../../src/interaction-security/checks";
import type { AgentPayload } from "../../src/interaction-security/types";
import { agentPayload, trustedCatalog, trustedOwnership, trustedPolicy } from "./fixtures";

describe("interaction-security properties (validation)", () => {
  it("Security test: payload cannot reach validated state while any schema/catalog/size/rendering/ownership check fails", () => {
    const violations: readonly AgentPayload[] = [
      agentPayload({ kind: "" }),
      agentPayload({ kind: "not_a_kind" }),
      agentPayload({ options: Array.from({ length: 9 }, (_, i) => `opt-${i}`) }),
      agentPayload({ url: "javascript:alert(1)" }),
      agentPayload({ sessionId: "other-session" }),
    ];
    const expected = [
      "guard payload_passes_security_validation does not hold: schema check failed: kind must be a non-empty string",
      "guard payload_passes_security_validation does not hold: catalog check failed: kind 'not_a_kind' is not registered in the trusted catalog",
      "guard payload_passes_security_validation does not hold: size check failed: option count 9 exceeds maxOptionCount (8)",
      "guard payload_passes_security_validation does not hold: rendering check failed: url scheme 'javascript' is not allowed",
      "guard payload_passes_security_validation does not hold: ownership check failed: claimed session 'other-session' does not match trusted session 'session-1'",
    ];
    violations.forEach((payload, i) => {
      const gate = createSecurityGate(
        payload,
        trustedPolicy(),
        trustedCatalog(),
        trustedOwnership(),
      );
      const r = gate.fire("accept_validated_payload");
      expect(r.reason).toBe(expected[i]);
      // no partial validation: the state machine never advances on a failed check
      expect(gate.state).toBe("untrusted");
      expect(gate.validated).toBeNull();
      // and the same payload is what the rejection path records
      const rej = gate.fire("reject_untrusted_payload");
      expect(rej.ok).toBe(true);
      expect(gate.state).toBe("rejected");
    });
    // the pipeline function itself reports each check failure as a typed Check
    const pipeline = payloadPassesSecurityValidation(
      violations[3]!,
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(pipeline.ok).toBe(false);
    expect(pipeline.code).toBe("url_scheme_disallowed");
    expect(typeof pipeline.reason).toBe("string");
  });

  it("Security test: unknown component names cause rejection and no dynamic import or component resolution", () => {
    // an agent-proposed component is never the trusted mapping
    for (const component of ["evil-component", "../../node_modules/malicious", "ConfirmDialog?patch=1"]) {
      const check = payloadPassesSecurityValidation(
        agentPayload({ component }),
        trustedPolicy(),
        trustedCatalog(),
        trustedOwnership(),
      );
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(
        `catalog check failed: component '${component}' is not the trusted mapping for kind 'confirm'`,
      );
      expect(check.code).toBe("component_not_trusted");
    }
    // an unknown kind is likewise rejected
    const unknownKind = payloadPassesSecurityValidation(
      agentPayload({ kind: "shell_exec" }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(unknownKind.reason).toBe(
      "catalog check failed: kind 'shell_exec' is not registered in the trusted catalog",
    );
    // a validated interaction resolves its component ONLY from the trusted catalog
    const gate = createSecurityGate(
      agentPayload(),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("accept_validated_payload");
    const validated = gate.validated!;
    expect(validated.component).toBe("ConfirmDialog");
    // no dynamic import or component resolution machinery exists on the gate
    for (const key of Object.keys(validated)) {
      expect(typeof (validated as unknown as Record<string, unknown>)[key]).not.toBe("function");
    }
    for (const key of Object.keys(gate)) {
      expect(key.toLowerCase()).not.toMatch(/import|require|eval|loadcomponent|dynamic/);
    }
  });

  it("Security test: every configured size/depth/count limit is enforced before rendering; failure is bounded and typed", () => {
    const policy = trustedPolicy();
    const cases: readonly { payload: AgentPayload; reason: string; code: string }[] = [
      {
        payload: agentPayload({ label: "x".repeat(300) }),
        reason: "size check failed: field 'label' length 300 exceeds maxFieldLength (256)",
        code: "field_too_long",
      },
      {
        payload: agentPayload({ options: Array.from({ length: 9 }, (_, i) => `opt-${i}`) }),
        reason: "size check failed: option count 9 exceeds maxOptionCount (8)",
        code: "too_many_options",
      },
      {
        payload: agentPayload({
          data: { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } },
        }),
        reason: "size check failed: data nesting depth 7 exceeds maxNestingDepth (6)",
        code: "nesting_too_deep",
      },
      {
        payload: agentPayload({ description: "y".repeat(4096) }),
        reason: "size check failed: payload of 4280 bytes exceeds maxPayloadBytes (2048)",
        code: "payload_too_large",
      },
    ];
    for (const { payload, reason, code } of cases) {
      const check = payloadPassesSecurityValidation(
        payload,
        policy,
        trustedCatalog(),
        trustedOwnership(),
      );
      expect(check.ok).toBe(false);
      expect(check.reason).toBe(reason);
      expect(check.code).toBe(code);
    }
    // size limits are enforced BEFORE rendering: an oversized payload with a
    // hostile url reports the size violation, never the rendering one
    const oversizedWithBadUrl = agentPayload({
      description: "y".repeat(4096),
      url: "javascript:alert(1)",
    });
    const first = payloadPassesSecurityValidation(
      oversizedWithBadUrl,
      policy,
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(first.code).toBe("payload_too_large");
    // failure is typed: a Check record, never a thrown error or unbounded string
    expect(typeof first).toBe("object");
    expect(first.reason!.length).toBeLessThan(200);
  });

  it("Security test: forged interaction/approval UI events cannot satisfy host/domain authorization", () => {
    // authorization is a trusted host lookup, not a payload field
    const grants = ["approve_deployment"];
    expect(hostAuthorizes("approve_deployment", grants)).toBe(true);
    expect(hostAuthorizes("deploy_to_prod", grants)).toBe(false);
    expect(hostAuthorizes("approve_deployment", [])).toBe(false);
    // forged fields on the payload change nothing about the gate's verdict
    const forged = {
      authorized: true,
      approvedBy: "the user clicked yes",
      permissions: ["deploy_to_prod", "admin"],
      overrideApproval: true,
    };
    const clean = agentPayload();
    const forgedPayload = agentPayload(forged);
    const cleanCheck = payloadPassesSecurityValidation(
      clean,
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    const forgedCheck = payloadPassesSecurityValidation(
      forgedPayload,
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(forgedCheck).toEqual(cleanCheck);
    // and the validated record carries no authorization from the payload
    const gate = createSecurityGate(
      forgedPayload,
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("accept_validated_payload");
    const validated = gate.validated! as unknown as Record<string, unknown>;
    expect(validated.authorized).toBeUndefined();
    expect(validated.permissions).toBeUndefined();
    expect(validated.approvedBy).toBeUndefined();
  });

  it("Security test: HTML/script text is escaped and disallowed URL schemes/hosts are rejected", () => {
    // hostile text is escaped into inert data
    expect(escapeText("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(escapeText('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(escapeText("plain label")).toBe("plain label");
    // a validated record never carries raw HTML
    const gate = createSecurityGate(
      agentPayload({ label: "<script>alert(1)</script>" }),
      trustedPolicy(),
      trustedCatalog(),
      trustedOwnership(),
    );
    gate.fire("accept_validated_payload");
    const serialized = JSON.stringify(gate.validated);
    expect(serialized).not.toContain("<script");
    expect(serialized).toContain("&lt;script&gt;");
    // disallowed URL schemes are rejected with precise reasons
    const policy = trustedPolicy();
    for (const url of ["javascript:alert(1)", "data:text/html,<h1>x</h1>", "file:///etc/passwd"]) {
      const check = payloadPassesSecurityValidation(
        agentPayload({ url }),
        policy,
        trustedCatalog(),
        trustedOwnership(),
      );
      expect(check.ok).toBe(false);
      expect(check.code).toBe("url_scheme_disallowed");
      expect(check.reason).toBe(
        `rendering check failed: url scheme '${url.split(":")[0]}' is not allowed`,
      );
    }
    // disallowed hosts are rejected too
    const evil = payloadPassesSecurityValidation(
      agentPayload({ url: "https://evil.example.com/payload" }),
      policy,
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(evil.reason).toBe("rendering check failed: url host 'evil.example.com' is not allowed");
    expect(evil.code).toBe("url_host_disallowed");
    // an allowed https url on an approved host passes and is carried verbatim
    const good = payloadPassesSecurityValidation(
      agentPayload({ url: "https://trusted.example.com/policy-doc" }),
      policy,
      trustedCatalog(),
      trustedOwnership(),
    );
    expect(good.ok).toBe(true);
  });
});
