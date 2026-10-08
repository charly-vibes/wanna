// Purpose: semantic property tests for the interaction-primitives gate
// Responsibilities: contribution-precedes-presentation, contracts-declarative, authority-orthogonal, and continuity-not-persistence-only corpus properties; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-primitives/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  contributionPrecedesPresentation,
  contractsDeclarative,
  authorityOrthogonal,
  GENERIC_AUTHORITY_SOURCES,
  continuityNotPersistenceOnly,
} from "../../src/interaction-primitives/invariants";
import { createPrimitiveSystemGate } from "../../src/interaction-primitives/machine";
import { validRevision } from "./fixtures";
import type { PrimitiveRevision } from "../../src/interaction-primitives/types";

describe("interaction-primitives properties: semantics", () => {
  it("interaction selection is grounded in a normalized need and semantic contribution before a host presentation is chosen", () => {
    // the canonical revision grounds every presentation in need + contribution first
    expect(contributionPrecedesPresentation(validRevision()).ok).toBe(true);

    // a selection that has not yet chosen a presentation is fine
    const noPresentation: PrimitiveRevision["selections"] = [
      { selectionId: "s1", needRef: "need-1", contributionRef: "contrib-1" },
    ];
    expect(contributionPrecedesPresentation(validRevision({ selections: noPresentation })).ok).toBe(true);

    // choosing a presentation without a grounded need is a violation, named precisely
    const noNeed: PrimitiveRevision["selections"] = [
      { selectionId: "s1", contributionRef: "contrib-1", presentationRef: "presentation-1" },
    ];
    expect(contributionPrecedesPresentation(validRevision({ selections: noNeed })).reason).toBe(
      'interaction selection "s1" chooses a presentation before a normalized need is grounded',
    );

    // choosing a presentation without a semantic contribution is a violation, named precisely
    const noContribution: PrimitiveRevision["selections"] = [
      { selectionId: "s1", needRef: "need-1", presentationRef: "presentation-1" },
    ];
    expect(contributionPrecedesPresentation(validRevision({ selections: noContribution })).reason).toBe(
      'interaction selection "s1" chooses a presentation before a semantic contribution is grounded',
    );

    // presentation-first across the whole revision fails the same way
    const flipped: PrimitiveRevision = {
      ...validRevision(),
      selections: [{ selectionId: "s1", presentationRef: "presentation-1" }],
    };
    expect(contributionPrecedesPresentation(flipped).ok).toBe(false);
  });

  it("agent-proposed interaction, presentation, workflow, and capability contracts are declarative data and cannot execute generated code in the trusted core", () => {
    // all four contract kinds in declarative-data form pass
    expect(contractsDeclarative(validRevision()).ok).toBe(true);

    const allKinds: PrimitiveRevision["contracts"] = [
      { contractId: "c1", kind: "interaction", form: "declarative-data" },
      { contractId: "c2", kind: "presentation", form: "declarative-data" },
      { contractId: "c3", kind: "workflow", form: "declarative-data" },
      { contractId: "c4", kind: "capability", form: "declarative-data" },
    ];
    expect(contractsDeclarative(validRevision({ contracts: allKinds })).ok).toBe(true);

    // executable-code form is rejected, named precisely
    const executable = validRevision({
      contracts: [{ contractId: "cx", kind: "capability", form: "executable-code" }],
    });
    expect(contractsDeclarative(executable).reason).toBe(
      'contract "cx" carries executable code and cannot enter the trusted core',
    );

    // a declarative contract that still references executable code is rejected
    const sneaky = validRevision({
      contracts: [{ contractId: "cx", kind: "workflow", form: "declarative-data", executableRef: "eval.js" }],
    });
    expect(contractsDeclarative(sneaky).reason).toBe(
      'contract "cx" references executable code "eval.js" — contracts are declarative data',
    );

    // gate-level: activate_valid_model refuses to activate such a revision
    const gate = createPrimitiveSystemGate(executable);
    gate.fire("validate_system_primitives");
    const r = gate.fire("activate_valid_model");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('contract "cx" carries executable code and cannot enter the trusted core');
  });

  it("model confidence, recommendation, verification, acknowledgement, UI rendering, or a generic click cannot independently grant protected authority", () => {
    // policy-sourced grants pass
    expect(authorityOrthogonal(validRevision()).ok).toBe(true);

    // every generic signal source is rejected as a grant origin, named precisely
    expect(GENERIC_AUTHORITY_SOURCES).toHaveLength(6);
    for (const source of GENERIC_AUTHORITY_SOURCES) {
      const grants = [{ grantId: "g1", effect: "deploy_revision", source }];
      const revision = validRevision({ authorityGrants: grants });
      expect(authorityOrthogonal(revision).reason).toBe(
        `authority grant "g1" derives from generic signal "${source}" — only policy or explicit grants establish authority`,
      );
    }

    // confidence alone cannot flip a grant decision: the same revision with a
    // higher-confidence signal still has no grant from that signal
    const grants = [
      { grantId: "g1", effect: "deploy_revision", source: "policy" as const },
      { grantId: "g2", effect: "deploy_revision", source: "confidence" as const },
    ];
    expect(authorityOrthogonal(validRevision({ authorityGrants: grants })).ok).toBe(false);
  });

  it("resumption includes reorientation and reconciliation semantics, not merely reloading serialized state", () => {
    // the canonical continuity record includes both semantics
    expect(continuityNotPersistenceOnly(validRevision()).ok).toBe(true);

    // a checkpoint without reorientation is persistence only, named precisely
    const noReorient: PrimitiveRevision["continuityRecords"] = [
      {
        checkpointId: "cp1",
        stateDigest: "digest-1",
        reconciliation: "reconcile in-flight contributions against the checkpoint",
      },
    ];
    expect(continuityNotPersistenceOnly(validRevision({ continuityRecords: noReorient })).reason).toBe(
      'continuity record "cp1" resumes from persisted state alone — reorientation semantics are missing',
    );

    // a checkpoint without reconciliation is persistence only, named precisely
    const noReconcile: PrimitiveRevision["continuityRecords"] = [
      {
        checkpointId: "cp1",
        stateDigest: "digest-1",
        reorientation: "brief the resuming agent on open bottlenecks",
      },
    ];
    expect(continuityNotPersistenceOnly(validRevision({ continuityRecords: noReconcile })).reason).toBe(
      'continuity record "cp1" resumes from persisted state alone — reconciliation semantics are missing',
    );

    // a bare state digest — pure persistence — fails on reorientation first
    const bare: PrimitiveRevision["continuityRecords"] = [{ checkpointId: "cp1", stateDigest: "digest-1" }];
    expect(continuityNotPersistenceOnly(validRevision({ continuityRecords: bare })).ok).toBe(false);
  });
});