// Purpose: property tests for the interaction-catalog
// Responsibilities: each corpus property of interaction-catalog as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-catalog/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createCatalogMachine, contentHash } from "../../src/interaction-catalog/machine";
import {
  catalogSchemaValid,
  publicationApproved,
  applyAgentProposal,
  resolveKindForNeed,
} from "../../src/interaction-catalog/invariants";
import {
  RUNTIME_VALIDATORS,
  TRUSTED_RENDERERS,
  REGISTERED_MIGRATIONS,
  validateResponse,
  resolveOptionReferences,
  resolveRenderer,
  migrateContract,
  createAuthorizeContract,
  authorizeDecision,
} from "../../src/interaction-catalog/registries";
import {
  V1,
  approvedReview,
  rejectedReview,
  reissueRetirement,
  renameKind,
  v1Catalog,
  withExtraKind,
  withoutBounds,
  withoutKind,
  withRenderer,
} from "./fixtures";
import type {
  AuthorizeContractInput,
  CatalogDefinition,
  OptionSpec,
  ResponseRecord,
} from "../../src/interaction-catalog/types";

const PINNED_V1 = `catalog_kind_set_pinned does not hold: version "${V1}" pins a different kind set; adding, removing, or renaming kinds requires a new catalog version and compatibility review`;
const AGENT_REASON =
  "agent proposal rejected: the kind set and need-to-kind mappings are versioned catalog data and cannot be authored or overridden by an untrusted agent proposal";

function publishedMachine(def: CatalogDefinition = v1Catalog()) {
  const m = createCatalogMachine(def);
  m.fire("validate_catalog");
  const r = m.fire("publish_pinned_catalog", { review: approvedReview() });
  if (!r.ok) throw new Error(`fixture could not publish: ${r.reason}`);
  return m;
}

function chooseResponse(selected: string[]): ResponseRecord {
  return { kind: "choose", fields: { selected, outcome: "selected" } };
}

const OPTIONS: readonly OptionSpec[] = [
  { id: "opt-1", label: "Ship it" },
  { id: "opt-2", label: "Hold" },
];

describe("interaction-catalog properties", () => {
  it("TypeScript test: every published kind has schema, outcomes, required fields, and a runtime validator", () => {
    const def = v1Catalog();
    // the canonical catalog passes schema validation end to end
    expect(catalogSchemaValid(def)).toEqual({ ok: true });
    for (const kd of def.kinds) {
      expect(Array.isArray(kd.requiredFields)).toBe(true);
      expect(kd.outcomes.length).toBeGreaterThan(0);
      expect(kd.bounds).toBeDefined();
      // a runtime validator is registered for every published kind — and it runs
      expect(typeof RUNTIME_VALIDATORS[kd.kind]).toBe("function");
    }
    expect(RUNTIME_VALIDATORS.choose(def.kinds[1]!, chooseResponse(["opt-1"]))).toEqual({ ok: true });
    // a response naming an undeclared outcome is rejected by the runtime validator
    const bad = validateResponse(def.kinds[1]!, { kind: "choose", fields: { selected: ["opt-1"], outcome: "winged_it" } });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('outcome "winged_it" is not in the declared outcome vocabulary for kind "choose"');
  });

  it("TypeScript test: adding/removing/renaming a kind without a catalog version change is rejected", () => {
    expect(catalogSchemaValid(withoutKind(v1Catalog(), "verify"))).toEqual({ ok: false, reason: PINNED_V1 });
    expect(catalogSchemaValid(renameKind(v1Catalog(), "clarify", "confirm"))).toEqual({ ok: false, reason: PINNED_V1 });
    expect(catalogSchemaValid(withExtraKind(v1Catalog(), "escalate"))).toEqual({ ok: false, reason: PINNED_V1 });
    // a new version lifts the pinned-set check — but the kind vocabulary stays closed
    const next = { ...withExtraKind(v1Catalog(), "escalate"), version: "interaction-catalog-1.1.0" };
    expect(catalogSchemaValid(next)).toEqual({
      ok: false,
      reason: 'catalog_kind_set_pinned does not hold: "escalate" is not a known interaction kind',
    });
  });

  it("TypeScript test: duplicate or changed display labels do not alias stable option IDs", () => {
    const dupLabels: readonly OptionSpec[] = [
      { id: "opt-1", label: "Ship it" },
      { id: "opt-2", label: "Ship it" },
    ];
    // responding with a label never resolves — even when labels are unique
    expect(resolveOptionReferences(OPTIONS, ["Ship it"])).toEqual({
      ok: false,
      reason: 'response_uses_stable_option_ids does not hold: "Ship it" is a display label, not a stable option ID',
    });
    // duplicate labels cannot alias: only the stable IDs are authoritative
    expect(resolveOptionReferences(dupLabels, ["opt-1", "opt-2"])).toEqual({ ok: true });
    // changing a display label leaves the stable option ID intact
    const relabeled: readonly OptionSpec[] = [{ id: "opt-1", label: "Ship now" }, OPTIONS[1]!];
    expect(resolveOptionReferences(relabeled, ["opt-1"])).toEqual({ ok: true });
    expect(resolveOptionReferences(relabeled, ["opt-2"])).toEqual({ ok: true });
  });

  it("TypeScript test: missing or violated kind bounds fail catalog validation or runtime input validation", () => {
    const def = v1Catalog();
    expect(catalogSchemaValid(withoutBounds(def, "choose"))).toEqual({
      ok: false,
      reason: 'bounds_defined_for_kind does not hold: kind "choose" declares no bounds',
    });
    const choose = def.kinds.find((k) => k.kind === "choose")!;
    // runtime input validation enforces the declared bounds with exact reasons
    expect(validateResponse(choose, chooseResponse(["o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9"]))).toEqual({
      ok: false,
      reason: 'bounds violation for kind "choose": 9 options exceed the declared maximum of 8',
    });
    expect(
      validateResponse(choose, { kind: "choose", fields: { selected: ["opt-1"], outcome: "selected", note: "x".repeat(257) } }),
    ).toEqual({
      ok: false,
      reason: 'bounds violation for kind "choose": field "note" exceeds the declared maximum string length of 256',
    });
    const review = def.kinds.find((k) => k.kind === "review")!;
    const blobFields = { decision: "accepted", outcome: "accepted", blob: "y".repeat(16385) };
    const blobBytes = JSON.stringify(blobFields).length;
    expect(validateResponse(review, { kind: "review", fields: blobFields })).toEqual({
      ok: false,
      reason: `bounds violation for kind "review": payload of ${blobBytes} bytes exceeds the declared maximum of 16384`,
    });
    expect(
      validateResponse(choose, { kind: "choose", fields: { selected: ["opt-1"], outcome: "selected", tree: { a: { b: { c: 1 } } } } }),
    ).toEqual({
      ok: false,
      reason: 'bounds violation for kind "choose": payload nesting exceeds the declared maximum of 2',
    });
  });

  it("Security test: an agent cannot add a kind or change a trusted need-to-kind mapping", () => {
    const def = v1Catalog();
    expect(applyAgentProposal(def, { addKind: { kind: "escalate" } })).toEqual({ ok: false, reason: AGENT_REASON });
    expect(applyAgentProposal(def, { setMapping: { needKind: "choose", primary: "configure" } })).toEqual({
      ok: false,
      reason: AGENT_REASON,
    });
    // the machine freezes the trusted definition: no mutation path exists at runtime either
    const m = publishedMachine(def);
    expect(Object.isFrozen(m.definition)).toBe(true);
    expect(Object.isFrozen(m.definition.mappings)).toBe(true);
    expect(Object.isFrozen(m.definition.kinds)).toBe(true);
  });

  it("TypeScript test: needs with no eligible catalog mapping return no-interaction rather than an invented kind", () => {
    const def = v1Catalog();
    expect(resolveKindForNeed(def, "delegate")).toEqual({ ok: false, outcome: "no_eligible_interaction" });
    expect(resolveKindForNeed(def, "escalate")).toEqual({ ok: false, outcome: "no_eligible_interaction" });
    // an unmapped need kind returns the same explicit outcome — never an invented kind
    expect(resolveKindForNeed(def, "welfare_check")).toEqual({ ok: false, outcome: "no_eligible_interaction" });
    expect(resolveKindForNeed(def, "choose")).toEqual({ ok: true, kind: "choose" });
    expect(resolveKindForNeed(def, "provide_evidence")).toEqual({ ok: true, kind: "diagnose" });
  });

  it("Security test: approval for one action/revision/actor/expiry cannot authorize a different action", () => {
    const input: AuthorizeContractInput = {
      action: "deploy:staging",
      scope: "pipeline-7",
      taskRevision: "task-7",
      actor: "alice",
      expiry: "2026-12-01T00:00:00Z",
      policyContext: "prod-change",
    };
    const contract = createAuthorizeContract(input);
    expect(contract.bindingHash.length).toBeGreaterThan(0);
    const matching = { action: input.action, taskRevision: input.taskRevision, actor: input.actor, expiry: input.expiry };
    expect(authorizeDecision(contract, matching)).toEqual({ ok: true });
    expect(authorizeDecision(contract, { ...matching, action: "deploy:prod" })).toEqual({
      ok: false,
      reason: 'authorization_scope_bound does not hold: decision action "deploy:prod" does not match contracted action "deploy:staging"',
    });
    expect(authorizeDecision(contract, { ...matching, taskRevision: "task-8" })).toEqual({
      ok: false,
      reason: 'authorization_scope_bound does not hold: decision task revision "task-8" does not match contracted revision "task-7"',
    });
    expect(authorizeDecision(contract, { ...matching, actor: "bob" })).toEqual({
      ok: false,
      reason: 'authorization_scope_bound does not hold: decision actor "bob" does not match contracted actor "alice"',
    });
    expect(authorizeDecision(contract, { ...matching, expiry: "2026-11-01T00:00:00Z" })).toEqual({
      ok: false,
      reason: 'authorization_scope_bound does not hold: decision expiry "2026-11-01T00:00:00Z" does not match contracted expiry "2026-12-01T00:00:00Z"',
    });
    // a different action binds to a different contract identity
    expect(createAuthorizeContract({ ...input, action: "deploy:prod" }).bindingHash).not.toBe(contract.bindingHash);
  });

  it("Security test: unknown renderer/module names cannot trigger dynamic component resolution", () => {
    expect(resolveRenderer("host:choice-list")).toEqual({ ok: true, renderer: "host:choice-list" });
    expect(resolveRenderer("../../evil/component")).toEqual({
      ok: false,
      reason: 'host_renderer_trusted does not hold: "../../evil/component" is not a registered trusted renderer',
    });
    expect(resolveRenderer("require('child_process')")).toEqual({
      ok: false,
      reason: "host_renderer_trusted does not hold: \"require('child_process')\" is not a registered trusted renderer",
    });
    // a catalog definition naming an unregistered renderer fails validation
    expect(catalogSchemaValid(withRenderer(v1Catalog(), "choose", "host:evil-widget"))).toEqual({
      ok: false,
      reason: 'host_renderer_trusted does not hold: kind "choose" names unregistered renderer "host:evil-widget"',
    });
    // the registry is a closed allowlist, exactly the renderers the canonical catalog binds
    expect(TRUSTED_RENDERERS.length).toBe(v1Catalog().kinds.length);
  });

  it("TypeScript test: published catalog version hash/content remains stable; edits require a new version", () => {
    const def = v1Catalog();
    const m = publishedMachine(def);
    expect(m.publishedHash).toBe(contentHash(def));
    // the published machine exposes no mutation path: every non-retirement transition is refused from published
    expect(m.fire("correct_catalog", { nextDefinition: def })).toEqual({
      ok: false,
      reason: "transition correct_catalog cannot fire from state published",
    });
    expect(m.fire("validate_catalog")).toEqual({
      ok: false,
      reason: "transition validate_catalog cannot fire from state published",
    });
    expect(m.publishedHash).toBe(contentHash(def));
    // a new version carries different content
    const next = { ...def, version: "interaction-catalog-1.1.0" };
    expect(contentHash(next)).not.toBe(contentHash(def));
  });

  it("TypeScript test: active contracts are migrated only by a registered migration, otherwise retired and reissued", () => {
    expect(Object.keys(REGISTERED_MIGRATIONS)).toContain("migrate-v1-to-v2");
    expect(migrateContract({ version: V1 }, "migrate-v1-to-v2")).toEqual({
      ok: true,
      version: "interaction-catalog-2.0.0",
    });
    expect(migrateContract({ version: V1 }, "migrate-v1-to-v9")).toEqual({
      ok: false,
      reason: 'catalog_retirement_explicit does not hold: no registered migration "migrate-v1-to-v9"; active contracts must be retired and reissued',
    });
    // the machine-side path: retire with an explicit reissue plan
    const m = publishedMachine();
    expect(m.fire("retire_catalog_version", { retirement: reissueRetirement() })).toEqual({ ok: true });
    expect(m.state).toBe("retired");
  });

  it("TypeScript test: invalid catalog returns to draft only after a corrected definition arrives", () => {
    const m = createCatalogMachine(withoutKind(v1Catalog(), "verify"));
    m.fire("reject_invalid_catalog");
    expect(m.state).toBe("invalid");
    expect(m.fire("correct_catalog")).toEqual({
      ok: false,
      reason: "corrected_catalog_received does not hold: no corrected catalog definition supplied",
    });
    expect(m.state).toBe("invalid");
    expect(m.fire("correct_catalog", { nextDefinition: v1Catalog() })).toEqual({ ok: true });
    expect(m.state).toBe("draft");
    // the corrected catalog validates cleanly
    expect(m.fire("validate_catalog")).toEqual({ ok: true });
    expect(m.state).toBe("validated");
  });

  it("TypeScript test: catalog cannot publish without validation, compatibility review, and immutable version ID", () => {
    // publication is unreachable from draft
    const draft = createCatalogMachine(v1Catalog());
    expect(draft.fire("publish_pinned_catalog", { review: approvedReview() })).toEqual({
      ok: false,
      reason: "transition publish_pinned_catalog cannot fire from state draft",
    });
    // a schema-invalid catalog never reaches validated
    const invalid = createCatalogMachine(withoutKind(v1Catalog(), "verify"));
    expect(invalid.fire("validate_catalog").ok).toBe(false);
    // validated but unreviewed / rejected-review catalogs refuse to publish
    const m = createCatalogMachine(v1Catalog());
    m.fire("validate_catalog");
    expect(m.fire("publish_pinned_catalog")).toEqual({
      ok: false,
      reason: "publication_approved_and_versioned does not hold: no compatibility review recorded",
    });
    expect(m.fire("publish_pinned_catalog", { review: rejectedReview() })).toEqual({
      ok: false,
      reason: "publication_approved_and_versioned does not hold: compatibility review was not approved",
    });
    expect(m.state).toBe("validated");
    // with an approved review and an immutable version, publication succeeds
    expect(m.fire("publish_pinned_catalog", { review: approvedReview() })).toEqual({ ok: true });
    expect(m.state).toBe("published");
    // and the guard would refuse a non-immutable version identifier
    const dev = createCatalogMachine({ ...v1Catalog(), version: "interaction-catalog-dev-draft" });
    dev.fire("validate_catalog");
    expect(publicationApproved(dev.definition, approvedReview())).toEqual({
      ok: false,
      reason: 'publication_approved_and_versioned does not hold: "interaction-catalog-dev-draft" is not an immutable version identifier',
    });
  });
});