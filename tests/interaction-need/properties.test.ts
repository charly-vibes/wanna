// Purpose: property tests for the interaction-need normalizer
// Responsibilities: each corpus property of interaction-need as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-need/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createNeedNormalizer } from "../../src/interaction-need/machine";
import {
  needSchemaValid,
  needNotPresentation,
  unresolvedRequiresChange,
  PRESENTATION_VOCABULARY,
  NEED_KINDS,
  TAXONOMY_VERSION,
} from "../../src/interaction-need/invariants";
import { validProposal } from "./fixtures";
import type { NeedProposal } from "../../src/interaction-need/types";

function normalize(p: NeedProposal) {
  const m = createNeedNormalizer(p);
  m.fire("validate_need");
  const r = m.fire("normalize_need");
  return { m, r };
}

describe("interaction-need properties", () => {
  it("a need validates against the versioned canonical schema before policy evaluation", () => {
    // a well-formed proposal validates; each schema violation invalidates it
    expect(needSchemaValid(validProposal()).ok).toBe(true);
    expect(needSchemaValid(validProposal({ kind: undefined })).ok).toBe(false);
    expect(needSchemaValid(validProposal({ kind: "not_a_kind" })).ok).toBe(false);
    expect(needSchemaValid(validProposal({ target: undefined })).ok).toBe(false);
    expect(needSchemaValid(validProposal({ taskRevision: undefined as never })).ok).toBe(false);
    // schema validity is decided before any policy evaluation can see the need
    const m = createNeedNormalizer(validProposal({ kind: "not_a_kind" }));
    expect(m.fire("validate_need").ok).toBe(false);
  });

  it("every normalized need records one supported need kind and taxonomy version", () => {
    for (const kind of NEED_KINDS) {
      const { r, m } = normalize(validProposal({ kind }));
      expect(r.ok).toBe(true);
      const need = m.normalized!;
      expect(NEED_KINDS).toContain(need.kind);
      expect(need.taxonomyVersion).toBe(TAXONOMY_VERSION);
    }
    // exactly one kind — the record carries no kind set or compound kinds
    const { m } = normalize(validProposal());
    expect(Object.keys(m.normalized!).filter((k) => k === "kind")).toHaveLength(1);
  });

  it("a normalized need identifies one immediate participation bottleneck; independent gaps are represented separately", () => {
    const { m } = normalize(validProposal());
    expect(typeof m.normalized!.target).toBe("string");
    expect(m.normalized!.target.length).toBeGreaterThan(0);
    // two independent gaps in one proposal is NOT normalizable as one need
    expect(needSchemaValid(validProposal({ target: ["gap-a", "gap-b"] as never })).ok).toBe(false);
    expect(needSchemaValid(validProposal({ target: ["gap-a", "gap-b"] as never })).reason).toMatch(/exactly one|independent/i);
  });

  it("TypeScript test: insufficient evidence yields unresolved", () => {
    // missing, contradictory, ambiguous, or weak evidence never becomes a
    // normalized need — and never an invented fact or default target
    for (const evidenceStrength of ["missing", "contradictory", "ambiguous", "weak"] as const) {
      const { r } = normalize(validProposal({ evidenceStrength }));
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/unresolved|target-immediate/i);
    }
    // the unresolved path is explicit, not a silent drop
    const m = createNeedNormalizer(validProposal({ evidenceStrength: "missing" }));
    m.fire("validate_need");
    m.fire("preserve_unresolved_need");
    expect(m.state).toBe("unresolved");
    expect(m.unresolvedRecord).toBeDefined();
  });

  it("Security test: changing model confidence alone cannot change a hard gate", () => {
    // identical proposal except confidence: outcome must be identical
    const low = validProposal({ confidence: 0.1 });
    const high = validProposal({ confidence: 0.99 });
    expect(needSchemaValid(low)).toEqual(needSchemaValid(high));
    const lowOut = normalize(low);
    const highOut = normalize(high);
    expect(lowOut.r.ok).toBe(highOut.r.ok);
    // confidence bump on an unresolved need does not unblock the retry guard
    const m = createNeedNormalizer(validProposal({ evidenceStrength: "weak" }));
    m.fire("validate_need");
    m.fire("preserve_unresolved_need");
    expect(m.retry(validProposal({ evidenceStrength: "weak", confidence: 0.99, proposalId: "same-state" })).ok).toBe(false);
  });

  it("Runtime test: unchanged unresolved need cannot self-trigger reclassification indefinitely", () => {
    const m = createNeedNormalizer(validProposal({ evidenceStrength: "weak" }));
    m.fire("validate_need");
    m.fire("preserve_unresolved_need");
    const record = m.unresolvedRecord!;
    // any number of identical retries is refused — the guard sees no change
    const unchanged = validProposal({ evidenceStrength: "weak" });
    for (let i = 0; i < 10; i++) {
      expect(m.retry(unchanged).ok).toBe(false);
      expect(m.state).toBe("unresolved");
    }
    // only new evidence (a change) re-proposes
    expect(m.retry(validProposal({ evidenceRefs: ["ev-3"], evidenceStrength: "sufficient" })).ok).toBe(true);
    expect(unresolvedRequiresChange(record, unchanged).ok).toBe(false);
  });

  it("need records contain no host components, layout instructions, executable renderer code, or UI-specific authorization instructions", () => {
    // a normalized need is host-free by construction
    const { m } = normalize(validProposal());
    const serialized = JSON.stringify(m.normalized);
    for (const token of PRESENTATION_VOCABULARY) {
      expect(serialized.toLowerCase()).not.toContain(token);
    }
    // a proposal embedding presentation vocabulary is schema-invalid and the
    // rejection names the leaked vocabulary
    const leak = needSchemaValid(validProposal({ target: "show a modal button component" }));
    expect(leak.ok).toBe(false);
    expect(leak.reason).toMatch(/modal|button|component/i);
    expect(needNotPresentation(validProposal())).toBe(true);
  });

  it("need records retain task revision, proposal identity, evidence references, taxonomy version, and model/normalizer provenance where applicable", () => {
    const proposal = validProposal({
      taskRevision: "task-42",
      proposalId: "prop-abc",
      evidenceRefs: ["ev-9", "ev-10"],
      confidence: 0.8,
    });
    const { m, r } = normalize(proposal);
    expect(r.ok).toBe(true);
    const need = m.normalized!;
    expect(need.taskRevision).toBe("task-42");
    expect(need.proposalId).toBe("prop-abc");
    expect(need.evidenceRefs).toEqual(["ev-9", "ev-10"]);
    expect(need.taxonomyVersion).toBe(TAXONOMY_VERSION);
    // normalizer provenance records which normalizer produced the need
    expect(typeof need.normalizedBy).toBe("string");
    expect(need.normalizedBy.length).toBeGreaterThan(0);
    // advisory model confidence is retained as evidence, never as a gate input
    expect(need.advisoryConfidence).toBe(0.8);
  });

  it("Policy test: a review need may map to an inspect/evaluate/verify pattern rather than a primitive named review", () => {
    // normalization must not resolve a compound kind into an atomic primitive:
    // the normalized record keeps the kind label verbatim and carries no
    // primitive/pattern binding — that selection is a separate policy step
    const { m } = normalize(validProposal({ kind: "review_artifact" }));
    const need = m.normalized as unknown as Record<string, unknown>;
    expect(need.kind).toBe("review_artifact");
    expect(need.primitive).toBeUndefined();
    expect(need.pattern).toBeUndefined();
    expect(need.atomic).toBeUndefined();
  });
});
