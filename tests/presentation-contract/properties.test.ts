// Purpose: property tests for the presentation-contract layer
// Responsibilities: each corpus property of presentation-contract as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/presentation-contract/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  SEMANTIC_ROLES,
  SEMANTIC_COMPONENT_ROLES,
  FALLBACK_KINDS,
  DENSITY_CATALOG,
  semanticRoleRequired,
  hostComponentNamesForbidden,
  contentHierarchyExplicit,
  densityBounded,
  untrustedTextInert,
} from "../../src/presentation-contract/invariants";
import {
  responseSemanticsPreserved,
  fallbackIsSemantic,
  uncertaintySemanticsPreserved,
} from "../../src/presentation-contract/rendering";
import { activeInteractionStable, adaptationReasonAvailable } from "../../src/presentation-contract/stability";
import { createPresentationMachine } from "../../src/presentation-contract/machine";
import type { PresentationView, ViewItem } from "../../src/presentation-contract/types";
import { renderRequestFor, validDraft } from "./fixtures";

function viewWith(items: ViewItem[], density = "compact"): PresentationView {
  return { actions: [], inertTexts: [], items, density, uncertainty: [] };
}

function leaf(id: string, content: string): ViewItem {
  return { id, content, children: [] };
}

describe("presentation-contract properties", () => {
  it("TypeScript conformance test: assert invariant semantic_role_required at its trust boundary and under its stated edge cases.", () => {
    // every supported semantic role passes at the trust boundary
    for (const role of SEMANTIC_ROLES) {
      expect(semanticRoleRequired(validDraft({ role })).ok).toBe(true);
    }
    // stated edge cases, each with a precise reason
    expect(semanticRoleRequired(validDraft({ role: undefined })).reason).toBe("missing semantic role");
    expect(semanticRoleRequired(validDraft({ role: "" })).reason).toBe("missing semantic role");
    expect(semanticRoleRequired(validDraft({ role: "navigate" })).reason).toBe("unsupported semantic role: navigate");
    // the transition boundary: validate fires only when the guard holds, reject only when it fails
    const ok = createPresentationMachine(validDraft());
    expect(ok.fire("validate_presentation").ok).toBe(true);
    const bad = createPresentationMachine(validDraft({ role: "navigate" }));
    expect(bad.fire("validate_presentation").ok).toBe(false);
    expect(bad.fire("reject_presentation").ok).toBe(true);
    const valid = createPresentationMachine(validDraft());
    expect(valid.fire("reject_presentation").ok).toBe(false);
  });

  it("TypeScript conformance test: assert invariant host_component_names_forbidden at its trust boundary and under its stated edge cases.", () => {
    // semantic component roles pass
    expect(hostComponentNamesForbidden(validDraft()).ok).toBe(true);
    for (const role of SEMANTIC_COMPONENT_ROLES) {
      expect(hostComponentNamesForbidden(validDraft({ components: [role] })).ok).toBe(true);
    }
    // module paths, host component names, and executable render functions are forbidden
    const modulePath = hostComponentNamesForbidden(validDraft({ components: ["ui/widgets/Button.tsx"] }));
    expect(modulePath.ok).toBe(false);
    expect(modulePath.reason).toBe("forbidden host reference in component role: ui/widgets/Button.tsx");
    const executable = hostComponentNamesForbidden(validDraft({ components: ["choose-target() => JSX"] }));
    expect(executable.ok).toBe(false);
    expect(executable.reason).toBe("forbidden host reference in component role: choose-target() => JSX");
    const hostName = hostComponentNamesForbidden(validDraft({ components: ["modal"] }));
    expect(hostName.ok).toBe(false);
    expect(hostName.reason).toBe("unsupported component role: modal");
  });

  it("TypeScript conformance test: assert invariant content_hierarchy_explicit at its trust boundary and under its stated edge cases.", () => {
    // primary task, supporting context, optional detail, and available actions are distinct present fields
    expect(contentHierarchyExplicit(validDraft()).ok).toBe(true);
    const draft = validDraft({ supportingContext: [], optionalDetail: [] });
    expect(contentHierarchyExplicit(draft).ok).toBe(true);
    for (const key of ["primaryTask", "supportingContext", "optionalDetail", "actions"]) {
      expect(Object.keys(draft)).toContain(key);
    }
    // each missing field is named precisely
    expect(contentHierarchyExplicit(validDraft({ primaryTask: undefined })).reason).toBe("missing primary task");
    expect(contentHierarchyExplicit(validDraft({ supportingContext: undefined })).reason).toBe(
      "missing supporting context field",
    );
    expect(contentHierarchyExplicit(validDraft({ optionalDetail: undefined })).reason).toBe(
      "missing optional detail field",
    );
    expect(contentHierarchyExplicit(validDraft({ actions: undefined })).reason).toBe("missing available actions field");
  });

  it("TypeScript conformance test: assert invariant density_bounded at its trust boundary and under its stated edge cases.", () => {
    // a view inside every catalog limit passes
    expect(densityBounded(viewWith([leaf("a", "small")])).ok).toBe(true);
    // item count: 12 is the boundary, 13 exceeds
    const atLimit = viewWith(Array.from({ length: DENSITY_CATALOG.maxItems }, (_, i) => leaf(`i${i}`, "x")));
    expect(densityBounded(atLimit).ok).toBe(true);
    const overItems = viewWith(Array.from({ length: DENSITY_CATALOG.maxItems + 1 }, (_, i) => leaf(`i${i}`, "x")));
    const overItemsCheck = densityBounded(overItems);
    expect(overItemsCheck.ok).toBe(false);
    expect(overItemsCheck.reason).toBe(`item count ${DENSITY_CATALOG.maxItems + 1} exceeds catalog limit ${DENSITY_CATALOG.maxItems}`);
    // nesting depth: 4 is the boundary, 5 exceeds (a flat list is depth 1)
    let deep = leaf("d0", "x");
    for (let i = 1; i < DENSITY_CATALOG.maxNestingDepth; i++) deep = { id: `d${i}`, content: "x", children: [deep] };
    expect(densityBounded(viewWith([deep])).ok).toBe(true);
    let tooDeep = leaf("d0", "x");
    for (let i = 1; i <= DENSITY_CATALOG.maxNestingDepth; i++) tooDeep = { id: `e${i}`, content: "x", children: [tooDeep] };
    const deepCheck = densityBounded(viewWith([tooDeep]));
    expect(deepCheck.ok).toBe(false);
    expect(deepCheck.reason).toBe(`nesting depth ${DENSITY_CATALOG.maxNestingDepth + 1} exceeds catalog limit ${DENSITY_CATALOG.maxNestingDepth}`);
    // content size
    const big = viewWith([leaf("b", "x".repeat(DENSITY_CATALOG.maxContentChars + 1))]);
    const bigCheck = densityBounded(big);
    expect(bigCheck.ok).toBe(false);
    expect(bigCheck.reason).toBe(`content size ${DENSITY_CATALOG.maxContentChars + 1} exceeds catalog limit ${DENSITY_CATALOG.maxContentChars}`);
    // density level must come from the catalog
    const lavish = densityBounded(viewWith([leaf("a", "x")], "lavish"));
    expect(lavish.ok).toBe(false);
    expect(lavish.reason).toBe("density level lavish is not in the catalog");
  });

  it("TypeScript conformance test: assert invariant response_semantics_preserved at its trust boundary and under its stated edge cases.", () => {
    const draft = validDraft();
    const declared = draft.actions!;
    // a host rendering that preserves id, meaning, and response schema passes
    expect(responseSemanticsPreserved(declared, [
      { actionId: "choose-target", meaning: declared[0].meaning, responseSchema: declared[0].responseSchema },
    ]).ok).toBe(true);
    // each violated aspect is named precisely
    const dropped = responseSemanticsPreserved(declared, []);
    expect(dropped.reason).toBe("host rendering drops declared action choose-target");
    const meaningChanged = responseSemanticsPreserved(declared, [
      { actionId: "choose-target", meaning: "other", responseSchema: declared[0].responseSchema },
    ]);
    expect(meaningChanged.reason).toBe("host rendering changed the meaning of action choose-target");
    const schemaChanged = responseSemanticsPreserved(declared, [
      { actionId: "choose-target", meaning: declared[0].meaning, responseSchema: [{ name: "target", type: "number" }] },
    ]);
    expect(schemaChanged.reason).toBe("host rendering changed the response schema of action choose-target");
    const introduced = responseSemanticsPreserved(declared, [
      { actionId: "choose-target", meaning: declared[0].meaning, responseSchema: declared[0].responseSchema },
      { actionId: "extra", meaning: "x", responseSchema: [] },
    ]);
    expect(introduced.reason).toBe("host rendering introduces undeclared action extra");
    // transition boundary: a failed guard leaves the machine validated, never renderable
    const m = createPresentationMachine(draft);
    m.fire("validate_presentation");
    expect(m.render({ actions: [] }).ok).toBe(false);
    expect(m.state).toBe("validated");
  });

  it("TypeScript conformance test: assert invariant fallback_is_semantic at its trust boundary and under its stated edge cases.", () => {
    const declared = validDraft().actions!;
    // all actions native: no substitutions needed
    expect(fallbackIsSemantic(declared, { nativeActionIds: ["choose-target"], substitutions: [] }).ok).toBe(true);
    // every documented semantically equivalent fallback kind is accepted
    for (const kind of FALLBACK_KINDS) {
      expect(fallbackIsSemantic(declared, {
        nativeActionIds: [],
        substitutions: [{ actionId: "choose-target", fallbackKind: kind }],
      }).ok).toBe(true);
    }
    // undocumented substitution kind
    const undocumented = fallbackIsSemantic(declared, {
      nativeActionIds: [],
      substitutions: [{ actionId: "choose-target", fallbackKind: "carousel" }],
    });
    expect(undocumented.reason).toBe("undocumented fallback kind: carousel");
    // uncovered non-native action
    const uncovered = fallbackIsSemantic(declared, { nativeActionIds: [], substitutions: [] });
    expect(uncovered.reason).toBe(
      "no documented semantically equivalent fallback for action choose-target; the host must return unsupported",
    );
    // the fallback view preserves meaning and response schema — only the presentation kind changed
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    expect(m.fallback({ nativeActionIds: [], substitutions: [{ actionId: "choose-target", fallbackKind: "text-list" }] }).ok).toBe(true);
    expect(m.state).toBe("fallback");
    expect(m.view!.actions).toEqual([{
      actionId: "choose-target",
      meaning: "select one deployment target",
      responseSchema: [{ name: "target", type: "string" }],
    }]);
  });

  it("TypeScript conformance test: assert invariant untrusted_text_inert at its trust boundary and under its stated edge cases.", () => {
    // inert text passes and is copied verbatim into the rendered view
    const inert = ["plain sentence", "value < 10 and cost > 3"];
    expect(untrustedTextInert(inert).ok).toBe(true);
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    m.render(renderRequestFor(validDraft()));
    expect(m.view!.inertTexts).toEqual(validDraft().texts);
    // markup signatures are named precisely
    const script = untrustedTextInert(["safe", "<script>alert(1)</script>"]);
    expect(script.ok).toBe(false);
    expect(script.reason).toBe("untrusted text contains markup or executable content (<script");
    expect(untrustedTextInert(["javascript:void(0)"]).reason).toBe("untrusted text contains markup or executable content (javascript:");
    expect(untrustedTextInert(["<img onerror=alert(1)>"]).reason).toBe("untrusted text contains markup or executable content (onerror=");
    // the rendering boundary refuses markup-laden untrusted text
    const bad = createPresentationMachine(validDraft({ texts: ["<script>x</script>"] }));
    bad.fire("validate_presentation");
    const r = bad.render(renderRequestFor(validDraft()));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("untrusted text contains markup or executable content (<script");
    expect(bad.state).toBe("validated");
  });

  it("Cross-host interaction test: active semantic actions remain stable during entry", () => {
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    m.render(renderRequestFor(validDraft()));
    const surface = m.activeSurface;
    expect(surface).toEqual(["choose-target"]);
    // a material reordering is refused during input, naming the stability rule
    const r = m.adapt({ reorder: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(
      "active response surface is stable during input; a material change requires a safety-critical transition or explicit user acceptance",
    );
    // a cross-host host may not replace the surface either
    const r2 = m.adapt({ replaceWith: ["other-action"] });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe(
      "active response surface is stable during input; a material change requires a safety-critical transition or explicit user acceptance",
    );
    expect(m.activeSurface).toEqual(surface);
    // explicit user acceptance permits the change; safety-critical transitions do too
    expect(m.adapt({ reorder: ["choose-target"], userAccepted: true, reason: "kept the declared order" }).ok).toBe(true);
    expect(m.activeSurface).toEqual(["choose-target"]);
    const m2 = createPresentationMachine(validDraft());
    m2.fire("validate_presentation");
    m2.render(renderRequestFor(validDraft()));
    expect(m2.adapt({ reorder: [], safetyCritical: true, reason: "policy requires the consent surface first" }).ok).toBe(true);
    // non-material changes never need acceptance
    expect(m.adapt({}).ok).toBe(true);
    expect(m.activeSurface).toEqual(["choose-target"]);
    // and there is no active surface to stabilize before rendering
    const early = createPresentationMachine(validDraft());
    expect(early.adapt({ reorder: [] }).reason).toBe("no active response surface in state proposed");
  });

  it("material adaptive presentation changes carry a user-comprehensible reason and, where safety permits, a stable/revert option", () => {
    const m = createPresentationMachine(validDraft());
    m.fire("validate_presentation");
    m.render(renderRequestFor(validDraft()));
    // an accepted material change without a reason is refused
    const r = m.adapt({ reorder: ["choose-target"], userAccepted: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("material adaptive presentation change requires a user-comprehensible reason");
    // with a reason the change lands — and a revert option is available where safety permits
    const r2 = m.adapt({ reorder: ["choose-target"], userAccepted: true, reason: "you asked for the compact list order" });
    expect(r2.ok).toBe(true);
    expect(m.revertible).toBe(true);
    expect(m.revert().ok).toBe(true);
    expect(m.activeSurface).toEqual(["choose-target"]);
    expect(m.revert().reason).toBe("no adaptive change to revert");
    // a safety-critical change does not offer revert — safety does not permit it
    const m2 = createPresentationMachine(validDraft());
    m2.fire("validate_presentation");
    m2.render(renderRequestFor(validDraft()));
    expect(m2.adapt({ reorder: [], safetyCritical: true, reason: "policy requires the consent surface first" }).ok).toBe(true);
    expect(m2.revertible).toBe(false);
    expect(m2.revert().ok).toBe(false);
    expect(m2.revert().reason).toBe("this adaptive change is safety-critical; revert is not available");
    // the reason guard itself: empty and missing reasons both fail
    expect(adaptationReasonAvailable({ reorder: ["x"], userAccepted: true, reason: "" }).ok).toBe(false);
    expect(adaptationReasonAvailable({ reorder: ["x"], userAccepted: true }).ok).toBe(false);
    expect(adaptationReasonAvailable({ reorder: ["x"], userAccepted: true, reason: "visible rationale" }).ok).toBe(true);
    // non-material changes never require a reason
    expect(adaptationReasonAvailable({}).ok).toBe(true);
    expect(activeInteractionStable(["a"], {}).ok).toBe(true);
  });

  it("presentation communicates only uncertainty metrics supplied with defined semantics and evidence; hosts do not fabricate confidence or force one visualization technique across modalities", () => {
    const supplied = [
      { id: "m1", value: 0.8, semantics: "calibrated probability", evidenceRefs: ["ev-1"] },
    ];
    // faithful rendering passes
    expect(uncertaintySemanticsPreserved(supplied, [{ metricId: "m1", value: 0.8 }]).ok).toBe(true);
    // omitting uncertainty entirely communicates nothing — that is allowed
    expect(uncertaintySemanticsPreserved(supplied, []).ok).toBe(true);
    // fabrication: a metric that was never supplied
    const fabricated = uncertaintySemanticsPreserved(supplied, [{ metricId: "m2", value: 0.9 }]);
    expect(fabricated.reason).toBe("hosts do not fabricate confidence: metric m2 was not supplied");
    // altering a supplied value
    const altered = uncertaintySemanticsPreserved(supplied, [{ metricId: "m1", value: 0.99 }]);
    expect(altered.reason).toBe("host rendering altered uncertainty metric m1");
    // a supplied metric without defined semantics or evidence cannot be communicated
    const noSemantics = uncertaintySemanticsPreserved(
      [{ id: "m1", value: 0.8, semantics: "", evidenceRefs: ["ev-1"] }],
      [{ metricId: "m1", value: 0.8 }],
    );
    expect(noSemantics.reason).toBe("metric m1 is supplied without defined semantics");
    const noEvidence = uncertaintySemanticsPreserved(
      [{ id: "m1", value: 0.8, semantics: "calibrated probability", evidenceRefs: [] }],
      [{ metricId: "m1", value: 0.8 }],
    );
    expect(noEvidence.reason).toBe("metric m1 is supplied without evidence");
    // one visualization technique forced across all modalities
    const forced = uncertaintySemanticsPreserved(supplied, [{ metricId: "m1", value: 0.8, forcedAcrossModalities: true }]);
    expect(forced.reason).toBe("hosts do not force one visualization technique across modalities");
  });
});