// Purpose: property tests for the interaction-contract layer
// Responsibilities: each corpus property of interaction-contract as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-contract/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createContractMachine } from "../../src/interaction-contract/machine";
import {
  accessibilityObligationsCarried,
  contractHasBoundedContent,
  contractIdentityComplete,
  contractIsDataOnly,
  contractKindAllowlisted,
  contractPayloadValid,
  contractVersionSupported,
  escapePathsDeclared,
  acceptResponse,
  rejectionCodeFor,
} from "../../src/interaction-contract/invariants";
import { migrateInteractionContract } from "../../src/interaction-contract/registries";
import { KIND_CONTRACT_SCHEMAS } from "../../src/interaction-contract/registries";
import { CONTRACT_CONTENT_LIMITS, CONTRACT_SCHEMA_VERSION } from "../../src/interaction-contract/types";
import { responseFor, validContract, payloadForKind, fullAccessibility } from "./fixtures";
import type { InteractionContract } from "../../src/interaction-contract/types";

const PINNED_KINDS = Object.keys(KIND_CONTRACT_SCHEMAS);
const UNSUPPORTED_VERSION = "interaction-contract-schema-9.9.9";

function machineFor(contract: InteractionContract) {
  return createContractMachine(contract);
}

function withoutPayloadField(kind: string, field: string): InteractionContract {
  const payload = payloadForKind(kind);
  const { [field]: _removed, ...rest } = payload;
  return validContract({ kind, payload: rest });
}

function withFillerPayload(targetBytes: number): Record<string, unknown> {
  const base = payloadForKind("choose");
  const probe = { ...base, pad: "" };
  const probeLen = JSON.stringify(probe).length;
  return { ...base, pad: "x".repeat(targetBytes - probeLen) };
}

function validatedMachine(contract: InteractionContract) {
  const m = machineFor(contract);
  const r = m.fire("validate_contract");
  if (!r.ok) throw new Error(`fixture could not validate: ${r.reason}`);
  return m;
}

describe("interaction-contract properties", () => {
  it("TypeScript test: malformed kind-specific payload never validates", () => {
    for (const kind of PINNED_KINDS) {
      const field = KIND_CONTRACT_SCHEMAS[kind as keyof typeof KIND_CONTRACT_SCHEMAS].requiredPayloadFields[0]!;
      const contract = withoutPayloadField(kind, field);
      const result = contractPayloadValid(contract);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        `contract_payload_valid does not hold: kind "${kind}" payload is missing required field "${field}"`,
      );
      expect(machineFor(contract).fire("validate_contract").ok).toBe(false);
    }
    // a required field with the wrong shape never validates either
    const wrongType = validContract({ payload: { ...payloadForKind("choose"), question: 42 } });
    expect(contractPayloadValid(wrongType).reason).toBe(
      'contract_payload_valid does not hold: kind "choose" payload field "question" must be a string or array',
    );
  });

  it("TypeScript test: unknown kinds are rejected without component lookup or dynamic import", () => {
    const contract = validContract({ kind: "confetti_cannon" });
    const result = contractPayloadValid(contract);
    expect(result.reason).toBe(
      'contract_kind_allowlisted does not hold: "confetti_cannon" is not a kind in the pinned host-neutral catalog',
    );
    // no implicit fallback: an unknown kind is never mapped onto a known one
    expect(result.reason).not.toMatch(/fallback|assume|default/);
    expect(machineFor(contract).fire("validate_contract").ok).toBe(false);
    // and the layer contains no dynamic import or component resolution machinery at all
    for (const file of readdirSync(join(__dirname, "../../src/interaction-contract"))) {
      const source = readFileSync(join(__dirname, "../../src/interaction-contract", file), "utf8");
      expect(source).not.toContain("import(");
    }
  });

  it("TypeScript test: each field rejects values just above its declared limit and accepts allowed boundary values", () => {
    const L = CONTRACT_CONTENT_LIMITS;
    const at = (n: number) => "x".repeat(n);
    // labels
    expect(contractHasBoundedContent(validContract({ payload: { ...payloadForKind("choose"), label: at(L.maxLabelLength) } })).ok).toBe(true);
    const labelOver = validContract({ payload: { ...payloadForKind("choose"), label: at(L.maxLabelLength + 1) } });
    expect(contractHasBoundedContent(labelOver).reason).toBe(
      `contract_has_bounded_content does not hold: label of ${L.maxLabelLength + 1} characters exceeds the declared maximum of ${L.maxLabelLength}`,
    );
    // descriptions
    const descOver = validContract({ payload: { ...payloadForKind("choose"), description: at(L.maxDescriptionLength + 1) } });
    expect(contractHasBoundedContent(descOver).reason).toBe(
      `contract_has_bounded_content does not hold: description of ${L.maxDescriptionLength + 1} characters exceeds the declared maximum of ${L.maxDescriptionLength}`,
    );
    // option counts and option values
    const many = Array.from({ length: L.maxOptions + 1 }, (_, i) => ({ id: `opt-${i}`, value: "v" }));
    expect(contractHasBoundedContent(validContract({ payload: { ...payloadForKind("choose"), options: many } })).reason).toBe(
      `contract_has_bounded_content does not hold: ${L.maxOptions + 1} options exceed the declared maximum of ${L.maxOptions}`,
    );
    const longValue = { id: "opt-1", value: at(L.maxOptionValueLength + 1) };
    expect(contractHasBoundedContent(validContract({ payload: { ...payloadForKind("choose"), options: [longValue] } })).reason).toBe(
      `contract_has_bounded_content does not hold: option value of ${L.maxOptionValueLength + 1} characters exceeds the declared maximum of ${L.maxOptionValueLength}`,
    );
    // numeric bounds and serialized payload size
    expect(contractHasBoundedContent(validContract({ payload: { ...payloadForKind("choose"), threshold: L.maxNumericValue } })).ok).toBe(true);
    expect(contractHasBoundedContent(validContract({ payload: { ...payloadForKind("choose"), threshold: L.maxNumericValue + 1 } })).reason).toBe(
      `contract_has_bounded_content does not hold: numeric value ${L.maxNumericValue + 1} exceeds the declared maximum of ${L.maxNumericValue}`,
    );
    expect(contractHasBoundedContent(validContract({ payload: withFillerPayload(L.maxPayloadBytes + 1) })).reason).toBe(
      `contract_has_bounded_content does not hold: payload of ${L.maxPayloadBytes + 1} bytes exceeds the declared maximum of ${L.maxPayloadBytes}`,
    );
    expect(contractHasBoundedContent(validContract({ payload: withFillerPayload(L.maxPayloadBytes) })).ok).toBe(true);
    // the machine refuses an out-of-bounds contract end to end
    expect(machineFor(labelOver).fire("validate_contract").ok).toBe(false);
  });

  it("TypeScript test: script/handler/HTML payloads are rejected or rendered as inert escaped text; never executed", () => {
    const withScript = validContract({ payload: { ...payloadForKind("choose"), snippet: "<script>alert(1)</script>" } });
    expect(contractIsDataOnly(withScript).reason).toBe(
      "contract_is_data_only does not hold: payload carries executable script content",
    );
    const withHandler = validContract({ payload: { ...payloadForKind("choose"), onClick: "submit()" } });
    expect(contractIsDataOnly(withHandler).reason).toBe(
      'contract_is_data_only does not hold: payload carries an event handler ("onclick")',
    );
    const withHtml = validContract({ payload: { ...payloadForKind("choose"), markup: "<b>hi</b>" } });
    expect(contractIsDataOnly(withHtml).reason).toBe(
      "contract_is_data_only does not hold: payload carries untrusted HTML markup",
    );
    const withExpr = validContract({ payload: { ...payloadForKind("choose"), expr: "{{user.name}}" } });
    expect(contractIsDataOnly(withExpr).reason).toBe(
      "contract_is_data_only does not hold: payload carries a host-evaluated expression",
    );
    const withComponent = validContract({ payload: { ...payloadForKind("choose"), component: "HostWidget" } });
    expect(contractIsDataOnly(withComponent).reason).toBe(
      'contract_is_data_only does not hold: payload names an arbitrary component ("component")',
    );
    // the machine refuses every data-only violation before it can reach a host
    for (const bad of [withScript, withHandler, withHtml, withExpr, withComponent]) {
      expect(machineFor(bad).fire("validate_contract").ok).toBe(false);
    }
    expect(contractIsDataOnly(validContract()).ok).toBe(true);
  });

  it("TypeScript test: accepted response preserves all IDs and preconditions from the originating contract", () => {
    const contract = validContract();
    const seen = new Set<string>();
    const good = responseFor(contract);
    expect(acceptResponse(contract, good, seen)).toEqual({ ok: true });
    expect(seen.has("evt-1")).toBe(true);
    const mismatches: readonly [keyof InteractionContract, string, string][] = [
      ["interactionId", "response interaction ID", "ix-other"],
      ["schemaVersion", "response contract-schema version", "interaction-contract-schema-2.0.0"],
      ["interactionRevision", "response interaction revision", "rev-9"],
      ["taskRevisionPrecondition", "response task revision precondition", "task-9"],
    ];
    for (const [field, fragment, value] of mismatches) {
      const result = acceptResponse(contract, responseFor(contract, { [field]: value }), new Set());
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        `response_correlated does not hold: ${fragment} does not match the originating contract`,
      );
    }
    expect(acceptResponse(contract, responseFor(contract, { eventId: "" }), new Set()).reason).toBe(
      "response_correlated does not hold: response carries no unique event ID",
    );
    expect(acceptResponse(contract, responseFor(contract), new Set(["evt-1"])).reason).toBe(
      "response_correlated does not hold: event ID \"evt-1\" was already accepted",
    );
    expect(acceptResponse(contract, responseFor(contract, { fields: {} }), new Set()).reason).toBe(
      'response_correlated does not hold: response is missing declared field "selected"',
    );
  });

  it("TypeScript test: unsupported schema version returns a typed error unless a registered migration succeeds", () => {
    const future = validContract({ schemaVersion: UNSUPPORTED_VERSION });
    const result = contractVersionSupported(future);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(
      `contract_version_migration_explicit does not hold: contract-schema version "${UNSUPPORTED_VERSION}" is unsupported and has no registered migration; it is never silently reinterpreted`,
    );
    // never silently reinterpreted as the supported version
    expect(contractPayloadValid(future).ok).toBe(false);
    expect(machineFor(future).fire("validate_contract").reason).toContain("never silently reinterpreted");
    // the explicit, registered migration path succeeds
    expect(migrateInteractionContract(CONTRACT_SCHEMA_VERSION, "migrate-contract-schema-v1-to-v2")).toEqual({
      ok: true,
      version: "interaction-contract-schema-2.0.0",
    });
    // unknown migration and mismatched source version are typed errors
    expect(migrateInteractionContract(CONTRACT_SCHEMA_VERSION, "no-such-migration").reason).toBe(
      'contract_version_migration_explicit does not hold: no registered migration "no-such-migration"',
    );
    expect(migrateInteractionContract(UNSUPPORTED_VERSION, "migrate-contract-schema-v1-to-v2").reason).toBe(
      `registered migration "migrate-contract-schema-v1-to-v2" applies to contract-schema version "${CONTRACT_SCHEMA_VERSION}", not "${UNSUPPORTED_VERSION}"`,
    );
    expect(contractVersionSupported(validContract()).ok).toBe(true);
  });

  it("TypeScript test: same invalid condition yields the same documented reason code without leaking secret data", () => {
    const bad = validContract({
      payload: { ...payloadForKind("choose"), label: "x".repeat(121), apiKey: "sk-secret-value-123" },
    });
    const first = contractPayloadValid(bad);
    const second = contractPayloadValid(bad);
    expect(first).toEqual(second);
    expect(first.reason).toBe(
      "contract_has_bounded_content does not hold: label of 121 characters exceeds the declared maximum of 120",
    );
    // the reason code is stable and documented, the diagnostic is non-sensitive
    expect(rejectionCodeFor(first.reason)).toBe("contract_has_bounded_content");
    expect(first.reason).not.toContain("sk-secret-value-123");
    expect(contractPayloadValid(validContract({ interactionId: "" })).reason).toBe(
      "contract_has_identity_and_version does not hold: missing interaction ID",
    );
    expect(rejectionCodeFor(contractPayloadValid(validContract({ interactionId: "" })).reason)).toBe(
      "contract_has_identity_and_version",
    );
  });

  it("TypeScript test: any missing required identity/version field makes validation fail", () => {
    const missing: readonly [Partial<InteractionContract>, string][] = [
      [{ interactionId: "" }, "missing interaction ID"],
      [{ schemaVersion: "" }, "missing contract-schema version"],
      [{ interactionRevision: "" }, "missing interaction revision"],
      [{ taskId: "" }, "missing task ID"],
      [{ taskRevisionPrecondition: "" }, "missing task revision precondition"],
    ];
    for (const [override, diagnostic] of missing) {
      const result = contractIdentityComplete(validContract(override));
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(`contract_has_identity_and_version does not hold: ${diagnostic}`);
      expect(contractPayloadValid(validContract(override)).ok).toBe(false);
    }
  });

  it("TypeScript test: invalid contract is not resubmitted until a new or corrected payload arrives", () => {
    const invalid = validContract({ kind: "confetti_cannon" });
    const m = machineFor(invalid);
    m.fire("reject_contract");
    // the machine refuses identical resubmission any number of times
    for (let i = 0; i < 3; i++) {
      expect(m.fire("revise_invalid_contract", { nextContract: invalid }).ok).toBe(false);
      expect(m.state).toBe("invalid");
    }
    const corrected = validContract({ interactionId: "ix-contract-2" });
    expect(m.fire("revise_invalid_contract", { nextContract: corrected }).ok).toBe(true);
    expect(m.state).toBe("proposed");
    // and only a validated corrected contract reaches validated again
    expect(m.fire("validate_contract").ok).toBe(true);
    expect(m.state).toBe("validated");
  });

  it("TypeScript test: validated contract remains active until explicit retirement, supersession, or expiry", () => {
    const m = validatedMachine(validContract());
    // no command — no retirement
    expect(m.fire("retire_contract").reason).toBe(
      "retirement_requested does not hold: retirement requires an explicit retire, supersede, or expiry command",
    );
    expect(m.fire("retire_contract", { command: { retire: true } }).reason).toBe(
      "retirement_requested does not hold: an explicit retirement command requires a reason",
    );
    expect(m.fire("retire_contract", { command: { supersededBy: "" } }).reason).toBe(
      "retirement_requested does not hold: an explicit supersession requires a superseding contract",
    );
    expect(m.fire("retire_contract", { command: { expiresAt: "" } }).reason).toBe(
      "retirement_requested does not hold: an explicit expiry requires a time",
    );
    expect(m.state).toBe("validated");
    expect(m.fire("retire_contract", { command: { retire: true, reason: "request withdrawn" } }).ok).toBe(true);
    expect(m.state).toBe("retired");
    const m2 = validatedMachine(validContract());
    expect(m2.fire("retire_contract", { command: { supersededBy: "ix-contract-2" } }).ok).toBe(true);
    const m3 = validatedMachine(validContract());
    expect(m3.fire("retire_contract", { command: { expiresAt: "2026-01-01T00:00:00Z" } }).ok).toBe(true);
  });

  it("Cross-host test: same contract preserves contribution primitive/pattern identity", () => {
    const contract = validContract();
    // a JSON round trip — what a different host would receive — preserves the contribution identity
    const roundTrip = JSON.parse(JSON.stringify(contract)) as InteractionContract;
    expect(roundTrip.contribution).toEqual({ primitive: "select" });
    expect(contractPayloadValid(roundTrip).ok).toBe(true);
    // the same kind can carry different contribution identities — purpose is never inferred from the kind
    const other = validContract({ contribution: { pattern: "review", patternVersion: "review-pattern-1.0.0" } });
    expect(contractPayloadValid(other).ok).toBe(true);
    // a contract with no contribution is rejected even though its kind is known
    const missing = validContract({ contribution: undefined as never });
    expect(contractPayloadValid(missing).reason).toBe(
      "contract_declares_contribution does not hold: contract declares no contribution",
    );
    expect(contractPayloadValid(validContract({ contribution: { primitive: "confetti" } as never })).reason).toBe(
      'contract_declares_contribution does not hold: unknown contribution primitive "confetti"',
    );
    expect(
      contractPayloadValid(validContract({ contribution: { pattern: "review" } as never })).reason,
    ).toBe("contract_declares_contribution does not hold: versioned pattern declaration requires a pattern version");
    expect(machineFor(missing).fire("validate_contract").ok).toBe(false);
  });

  it("Schema test: renderable contracts expose required accessibility obligations", () => {
    const required = ["naming", "operation", "focusNavigation", "statusErrors", "timing"] as const;
    for (const key of required) {
      const partial = fullAccessibility();
      const { [key]: _dropped, ...incomplete } = partial;
      const contract = validContract({ accessibility: incomplete as never });
      const result = accessibilityObligationsCarried(contract);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        `accessibility_obligations_carried does not hold: contract is missing the "${key}" obligation`,
      );
      expect(contractPayloadValid(contract).ok).toBe(false);
    }
    // timing may be explicitly declared not applicable — absence is never implied
    expect(accessibilityObligationsCarried(validContract()).ok).toBe(true);
    expect(accessibilityObligationsCarried(validContract({ accessibility: { ...fullAccessibility(), timing: "30s" } })).ok).toBe(true);
  });

  it("every contract declares supported reject, defer, cancel, dismiss, and timeout semantics instead of treating absence as an answer", () => {
    const required = ["reject", "defer", "cancel", "dismiss", "timeout"] as const;
    for (const key of required) {
      const partial = validContract().escapePaths;
      const { [key]: _dropped, ...incomplete } = partial;
      const contract = validContract({ escapePaths: incomplete as never });
      const result = escapePathsDeclared(contract);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(
        `escape_paths_declared does not hold: contract does not declare the "${key}" escape path`,
      );
      expect(machineFor(contract).fire("validate_contract").ok).toBe(false);
    }
    expect(escapePathsDeclared(validContract()).ok).toBe(true);
  });
});