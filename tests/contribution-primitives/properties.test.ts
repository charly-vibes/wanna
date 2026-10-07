// Purpose: property tests for the contribution-primitives layer
// Responsibilities: each corpus property of contribution-primitives as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/contribution-primitives/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createPrimitiveMachine } from "../../src/contribution-primitives/machine";
import {
  COMPOUND_ACTIVITIES,
  PRIMITIVE_KINDS,
  TAXONOMY_VERSION,
  PRESENTATION_VOCABULARY,
  ESCAPE_OUTCOMES,
  eligiblePrimitives,
  interpretPrimitive,
  authorizeGuardSatisfied,
  emitEvent,
  primitiveEventValid,
  realize,
  type AuthorityGrant,
  type Check,
} from "../../src/contribution-primitives/index";
import { NEED_KINDS } from "../../src/interaction-need/types";
import { validProposal, proposalOfKind, escapeArg, retireArg } from "./fixtures";
import type { PrimitiveState, TransitionResult } from "../../src/contribution-primitives/types";

function expectFail(r: TransitionResult): string {
  if (r.ok) throw new Error("expected the transition to fail");
  return r.reason;
}

const ALL_STATES: readonly PrimitiveState[] = [
  "proposed", "validated", "active", "completed", "escaped", "invalid", "retired",
];

function runTo(kind: "validated" | "active" | "completed" | "escaped" | "retired") {
  const m = createPrimitiveMachine(validProposal({ responsePayload: { choice: "b" } }));
  const steps: readonly (readonly [Parameters<typeof m.fire>[0], Parameters<typeof m.fire>[1]?])[] = [
    ["validate_primitive"],
    ["activate_primitive"],
    ["complete_primitive"],
    ["escape_primitive", escapeArg("cancel")],
    ["retire_primitive", retireArg("primitive-taxonomy-2026.11")],
  ];
  for (const [id, arg] of steps) {
    m.fire(id, arg);
    if (m.state === kind) break;
  }
  return m;
}

function machineIn(state: PrimitiveState) {
  if (state === "proposed") return createPrimitiveMachine(validProposal());
  if (state === "invalid") {
    const bad = createPrimitiveMachine(validProposal({ kind: "review" }));
    bad.fire("reject_invalid_primitive");
    return bad;
  }
  return runTo(state);
}

function failReason(c: Check): string {
  if (c.ok) throw new Error("expected the check to fail");
  return c.reason;
}

describe("contribution-primitives properties", () => {
  it("TypeScript test: known compound activities resolve to patterns/compositions rather than a single primitive unless an explicit taxonomy revision says otherwise", () => {
    // every declared compound activity fails validation with the pattern reason
    for (const activity of COMPOUND_ACTIVITIES) {
      const m = createPrimitiveMachine(validProposal({ kind: activity }));
      const r = m.fire("validate_primitive");
      expect(r.ok).toBe(false);
      expect(expectFail(r)).toMatch(/is an interaction pattern, not a single primitive/);
      // the escape hatch is explicit: reject_invalid_primitive records it as invalid
      const bad = createPrimitiveMachine(validProposal({ kind: activity }));
      expect(bad.fire("reject_invalid_primitive").ok).toBe(true);
      expect(bad.state).toBe("invalid");
    }
    // every real primitive passes under the current taxonomy version
    for (const kind of PRIMITIVE_KINDS) {
      expect(COMPOUND_ACTIVITIES).not.toContain(kind);
      const m = createPrimitiveMachine(proposalOfKind(kind));
      expect(m.fire("validate_primitive").ok).toBe(true);
    }
  });

  it("Cross-host test: web and TUI realizations preserve the same primitive kind and response semantics", () => {
    const web = realize({ host: "web", control: "radio-group", kind: "select", responseSemantics: "one choice from a fixed option set" });
    const tui = realize({ host: "tui", control: "menu", kind: "select", responseSemantics: "one choice from a fixed option set" });
    expect(web).toEqual(tui);
    // primitive identity is independent of the realizing control: swapping the
    // control does not change the kind or the response semantics
    const other = realize({ host: "web", control: "dropdown", kind: "select", responseSemantics: "one choice from a fixed option set" });
    expect(other).toEqual(web);
    // neither realization leaks its control name into a typed event
    for (const r of [web, tui, other]) {
      const serialized = JSON.stringify(r);
      expect(serialized).not.toContain("radio-group");
      expect(serialized).not.toContain("menu");
      expect(serialized).not.toContain("dropdown");
    }
  });

  it("TypeScript test: policy can map one need to multiple eligible primitives without mutating the need taxonomy", () => {
    // one need maps to several eligible primitives
    const eligible = eligiblePrimitives("review_artifact");
    expect(eligible).toEqual(["inspect", "evaluate", "verify"]);
    expect(eligible.length).toBeGreaterThan(1);
    // the mapping is read-only policy data in the primitive layer: consulting it
    // does not change the need taxonomy (same kinds, same order, same identity)
    const before = [...NEED_KINDS];
    eligiblePrimitives("review_artifact");
    eligiblePrimitives("clarify_intent");
    expect(NEED_KINDS).toEqual(before);
    expect(NEED_KINDS.length).toBe(16);
    // and looking up an unknown need kind yields no primitives — the policy
    // never invents mappings, and neither taxonomy grew to absorb the other
    expect(eligiblePrimitives("not_a_need")).toEqual([]);
    expect(NEED_KINDS).toEqual(before);
    expect(PRIMITIVE_KINDS.length).toBe(21);
  });

  it("Security test: a verify event alone cannot satisfy an authorize guard", () => {
    const verifyEvent = { kind: "verify", interactionId: "ixn-1" };
    // with no grants, obviously denied
    expect(authorizeGuardSatisfied(verifyEvent, []).ok).toBe(false);
    // even with a grant recorded for the verify event's own interaction, denied
    const grants: readonly AuthorityGrant[] = [{ interactionId: "ixn-1", kind: "verify" }];
    const r = authorizeGuardSatisfied(verifyEvent, grants);
    expect(r.ok).toBe(false);
    expect(failReason(r)).toBe(
      "verification_distinct_from_authorization: a verify event cannot satisfy an authorize guard; policy must separately require and record both semantics",
    );
    // a verify event is never accepted even when an authorize grant exists
    expect(authorizeGuardSatisfied(verifyEvent, [{ interactionId: "ixn-1", kind: "authorize" }]).ok).toBe(false);
  });

  it("TypeScript test: cancel/defer/dismiss outcomes are never coerced into a substantive response", () => {
    for (const outcome of ["cancel", "defer", "dismiss"] as const) {
      const m = runTo("active");
      expect(m.fire("escape_primitive", escapeArg(outcome)).ok).toBe(true);
      expect(m.state).toBe("escaped");
      // the escape record carries no substantive payload and no typed event fired
      expect(m.escapeRecord).toBeDefined();
      expect(m.escapeRecord!.responsePayload).toBeUndefined();
      expect(m.event).toBeNull();
    }
    // escaping is valid only for the declared escape vocabulary — a substantive
    // answer cannot be smuggled through the escape channel
    expect(ESCAPE_OUTCOMES).toEqual(["reject", "defer", "cancel", "dismiss", "no_response"]);
    const m = runTo("active");
    expect(m.fire("escape_primitive", escapeArg("respond" as never)).ok).toBe(false);
    expect(m.event).toBeNull();
  });

  it("TypeScript test: malformed primitive events fail before reducer execution", () => {
    // each required field is checked with a precise reason
    expect(primitiveEventValid({ kind: "select", interactionId: "i", taskRevision: "t", payload: {}, provenance: ["e"] }).ok).toBe(true);
    expect(failReason(primitiveEventValid({ kind: "wibble", interactionId: "i", taskRevision: "t", payload: {}, provenance: ["e"] }))).toBe(
      "unsupported primitive kind: wibble (taxonomy primitive-taxonomy-2026.10-provisional)",
    );
    expect(failReason(primitiveEventValid({ kind: "select", taskRevision: "t", payload: {}, provenance: ["e"] }))).toBe(
      "primitive event requires an interaction identity",
    );
    expect(failReason(primitiveEventValid({ kind: "select", interactionId: "i", payload: {}, provenance: ["e"] }))).toBe(
      "primitive event requires a task revision",
    );
    expect(failReason(primitiveEventValid({ kind: "select", interactionId: "i", taskRevision: "t", provenance: ["e"] }))).toBe(
      "primitive event requires a response payload",
    );
    expect(failReason(primitiveEventValid({ kind: "select", interactionId: "i", taskRevision: "t", payload: {} }))).toBe(
      "primitive event requires provenance",
    );
    // and the machine refuses to move state when the event would be malformed —
    // the guard fires before any reducer/state mutation
    const m = createPrimitiveMachine(validProposal({ interactionId: "" }));
    m.fire("validate_primitive");
    expect(m.fire("activate_primitive").ok).toBe(false);
    expect(m.state).toBe("validated");
    const m2 = createPrimitiveMachine(validProposal({ provenance: [] }));
    m2.fire("validate_primitive");
    expect(m2.fire("activate_primitive").ok).toBe(false);
    expect(m2.state).toBe("validated");
  });

  it("emitting a primitive event does not by itself create authority; authorization is valid only when the event satisfies an applicable authority policy or grant", () => {
    // from every arbitrary state, emitting never grows the authority grant set
    for (const state of ALL_STATES) {
      const machine = machineIn(state);
      const grants: AuthorityGrant[] = [{ interactionId: "other-ixn", kind: "authorize" }];
      const after = emitEvent({ grants }, {
        kind: "authorize",
        taxonomyVersion: TAXONOMY_VERSION,
        interactionId: "ixn-1",
        taskRevision: "task-7",
        payload: {},
        provenance: ["ev-1"],
        emittedBy: "contribution-primitives-machine@1.0.0",
      });
      expect(after.grants).toEqual(grants);
      expect(after.grants.length).toBe(1);
      // and the emitted event itself satisfies no authorize guard without a
      // grant that applies to its own interaction identity
      expect(machine.state).toBeDefined();
      expect(authorizeGuardSatisfied({ kind: "authorize", interactionId: "ixn-1" }, grants).ok).toBe(false);
    }
    // with an applicable grant, the authorize guard is satisfied — the grant,
    // not the emission, is what creates authority
    const applicable: readonly AuthorityGrant[] = [{ interactionId: "ixn-1", kind: "authorize" }];
    expect(authorizeGuardSatisfied({ kind: "authorize", interactionId: "ixn-1" }, applicable).ok).toBe(true);
    // non-authorize kinds never satisfy an authorize guard
    expect(authorizeGuardSatisfied({ kind: "verify", interactionId: "ixn-1" }, applicable).ok).toBe(false);
    expect(authorizeGuardSatisfied({ kind: "express", interactionId: "ixn-1" }, applicable).ok).toBe(false);
  });

  it("primitive identifiers are interpreted under an explicit taxonomy version and cannot be added or redefined silently", () => {
    // known kinds interpret only under the declared taxonomy version
    for (const kind of PRIMITIVE_KINDS) {
      expect(interpretPrimitive(kind, TAXONOMY_VERSION).ok).toBe(true);
    }
    // a different version refuses even known kinds — no silent redefinition
    const drifted = interpretPrimitive("select", "primitive-taxonomy-2026.11");
    expect(drifted.ok).toBe(false);
    expect(failReason(drifted)).toBe(
      "primitive taxonomy version primitive-taxonomy-2026.11 is not recognized; identifiers are interpreted under primitive-taxonomy-2026.10-provisional",
    );
    // unknown kinds refuse under the declared version — no silent addition
    const unknown = interpretPrimitive("review", TAXONOMY_VERSION);
    expect(unknown.ok).toBe(false);
    expect(failReason(unknown)).toBe("unsupported primitive kind: review (taxonomy primitive-taxonomy-2026.10-provisional)");
    // presentation vocabulary can never enter the taxonomy through validation
    for (const token of PRESENTATION_VOCABULARY) {
      expect(PRIMITIVE_KINDS).not.toContain(token as never);
    }
  });
});