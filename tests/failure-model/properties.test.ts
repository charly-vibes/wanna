// Purpose: property tests for the failure model
// Responsibilities: each corpus property of failure-model as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/failure-model/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { createFailureModel } from "../../src/failure-model/machine";
import {
  AI_FAILURE_CLASSES,
  RECOVERABILITY_CATEGORIES,
  renderFailureStatus,
  retryPathAllowed,
} from "../../src/failure-model/index";
import { assessment, draftFailure, typedFailureRecord } from "./fixtures";
import type { FailureClass, FailureRecord, Recoverability } from "../../src/failure-model/types";

function containedMachine(record = typedFailureRecord()) {
  const m = createFailureModel(record);
  m.fire("contain_failure", { kind: "record", record });
  return m;
}

function assessedMachine(record = typedFailureRecord()) {
  const m = containedMachine(record);
  m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
  return m;
}

describe("failure-model properties", () => {
  it("Fault-injection test: lost acknowledgement after a mutating request yields effect_unknown until reconciliation supplies evidence", () => {
    const m = containedMachine(typedFailureRecord({ failureClass: "timeout" }));
    // fault injection: the adapter lost the acknowledgement — claiming no_effect is refused
    const claimed = m.fire("assess_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    expect(claimed.ok).toBe(false);
    expect(claimed.reason).toMatch(/cannot imply no_effect/);
    // until reconciliation supplies evidence, the outcome is effect_unknown
    const uncertain = m.fire("assess_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "effect_unknown" }),
    });
    expect(uncertain.ok).toBe(true);
    expect(m.state).toBe("assessing");
    expect(m.fire("classify_known_failure", { kind: "assessment", assessment: assessment() }).ok).toBe(false);
    expect(m.fire("classify_uncertain_failure", { kind: "assessment", assessment: assessment() }).ok).toBe(true);
    expect(m.state).toBe("uncertain");
    // reconciliation supplies evidence — only then may the outcome be known
    const record = typedFailureRecord({ failureClass: "timeout" });
    const reconciled = assessment({
      effectCertainty: "effect_applied",
      reconciliationEvidence: ["recon-effect-1"],
      retrySafety: "proven_idempotent",
    });
    const m2 = createFailureModel(record);
    m2.fire("contain_failure", { kind: "record", record });
    expect(m2.fire("assess_failure", { kind: "assessment", assessment: reconciled }).ok).toBe(true);
    expect(m2.fire("classify_known_failure", { kind: "assessment", assessment: reconciled }).ok).toBe(true);
    expect(m2.state).toBe("known");
  });

  it("TypeScript test: non-idempotent unknown-effect failure cannot enter retry path", () => {
    const record = typedFailureRecord({ mutating: true });
    // requires reconciliation — the retry path is refused while the effect state is unknown
    const reconcile = retryPathAllowed(record, assessment({
      retrySafety: "requires_reconciliation",
      effectCertainty: "effect_unknown",
    }));
    expect(reconcile.ok).toBe(false);
    expect(reconcile.reason).toMatch(/retry path/);
    expect(reconcile.reason).toMatch(/effect_unknown/);
    // explicitly prohibited until the effect state is known — likewise refused
    const prohibited = retryPathAllowed(record, assessment({
      retrySafety: "prohibited_until_effect_state_known",
      effectCertainty: "effect_unknown",
    }));
    expect(prohibited.ok).toBe(false);
    // even a proven-idempotent retry is blocked while the effect state is unknown
    const idempotentButUnknown = retryPathAllowed(record, assessment({
      retrySafety: "proven_idempotent",
      effectCertainty: "effect_unknown",
    }));
    expect(idempotentButUnknown.ok).toBe(false);
    // once the effect state is known and retry is proven idempotent, the path opens
    const safe = retryPathAllowed(record, assessment({
      retrySafety: "proven_idempotent",
      effectCertainty: "effect_applied",
    }));
    expect(safe.ok).toBe(true);
  });

  it("Recovery test: recoverable infrastructure failure retains validated draft data", () => {
    const record = draftFailure();
    const m = containedMachine(record);
    expect(m.state).toBe("contained");
    // containment preserves validated input, drafts, and audit history verbatim
    expect(m.record?.userWork).toEqual(record.userWork);
    expect(m.record?.userWork?.drafts).toEqual(["draft-1", "draft-2"]);
    expect(m.record?.userWork?.validatedInput).toEqual(["input-shipping-address"]);
    expect(m.record?.userWork?.auditHistory).toEqual(["audit-1", "audit-2", "audit-3"]);
    // preservation survives the assessment step too
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    expect(m.record?.userWork).toEqual(record.userWork);
  });

  it("UX contract test: unknown effect state cannot render as definitely failed or definitely succeeded", () => {
    const record = typedFailureRecord();
    const status = renderFailureStatus(record, assessment({ effectCertainty: "effect_unknown" }));
    const rendered = JSON.stringify(status);
    // neither a definite failure nor a definite success of the effect may be claimed
    expect(rendered.toLowerCase()).not.toContain("definitely failed");
    expect(rendered.toLowerCase()).not.toContain("definitely succeeded");
    expect(rendered.toLowerCase()).not.toContain("effect failed");
    // the four segments distinguish what is known, what failed, what may have succeeded, what remains uncertain
    expect(status.known.length).toBeGreaterThan(0);
    expect(status.failed.length).toBeGreaterThan(0);
    expect(status.mayHaveSucceeded.length).toBeGreaterThan(0);
    expect(status.uncertain.length).toBeGreaterThan(0);
    // a known certainty renders its definite outcome — the distinction is real
    const applied = renderFailureStatus(record, assessment({ effectCertainty: "effect_applied" }));
    expect(applied.known.join(" ")).toMatch(/effect_applied/);
    expect(applied.uncertain.length).toBe(0);
  });

  it("every failure record declares class, origin, scope, severity category, affected task/process revision, and observed evidence", () => {
    // each required field omitted in turn makes containment refuse, naming the field
    const omitted: ReadonlyArray<readonly [string, FailureRecord]> = [
      ["failureClass", typedFailureRecord({ failureClass: undefined as never })],
      ["origin", typedFailureRecord({ origin: undefined as never })],
      ["scope", typedFailureRecord({ scope: undefined as never })],
      ["severity", typedFailureRecord({ severity: undefined as never })],
      ["affectedRevision", typedFailureRecord({ affectedRevision: "" })],
      ["evidence", typedFailureRecord({ evidence: [] })],
    ];
    for (const [field, record] of omitted) {
      const m = createFailureModel(record);
      const r = m.fire("contain_failure", { kind: "record", record });
      expect(r.ok, `${field} must be required`).toBe(false);
      expect(r.reason).toContain("failure_is_typed");
      expect(r.reason).toContain(field === "affectedRevision" ? "affected" : field);
      expect(m.state).toBe("detected");
    }
    // a fully typed record is contained
    expect(containedMachine().state).toBe("contained");
  });

  it("failure records classify recovery as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown", () => {
    // every declared category resolves a known failure
    for (const recoverability of RECOVERABILITY_CATEGORIES) {
      const m = assessedMachine();
      m.fire("classify_known_failure", {
        kind: "assessment",
        assessment: assessment({ effectCertainty: "no_effect" }),
      });
      const r = m.fire("resolve_known_failure", {
        kind: "assessment",
        assessment: assessment({ effectCertainty: "no_effect", recoverability }),
      });
      expect(r.ok, `${recoverability} must resolve`).toBe(true);
      expect(m.state).toBe("resolved");
    }
    // an unclassified or out-of-set recovery is refused, naming the closed set
    const m = assessedMachine();
    m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect" }),
    });
    const r = m.fire("resolve_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect", recoverability: "magically" as Recoverability }),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("recoverability_explicit");
    expect(r.reason).toContain("automatic");
    expect(r.reason).toContain("unrecoverable/unknown");
  });

  it("malformed generated UI, invalid plans, tool loops, policy violations, or untrusted generated code cannot mutate authoritative state merely because generation succeeded", () => {
    for (const failureClass of AI_FAILURE_CLASSES) {
      const record = typedFailureRecord({
        failureClass: failureClass as FailureClass,
        origin: "generated",
        generated: true,
        mutating: true,
      });
      const m = containedMachine(record);
      expect(m.state).toBe("contained");
      // generation success alone authorizes nothing: the machine holds no mutation channel
      expect(m.mutations).toEqual([]);
      // walking the full escalation path still performs no authoritative mutation
      m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
      m.fire("classify_uncertain_failure", { kind: "assessment", assessment: assessment() });
      m.fire("escalate_uncertain_failure");
      expect(m.mutations).toEqual([]);
    }
  });

  it("failure records retain relevant event IDs, effect IDs, tool/adapter identity, versions, timestamps supplied by trusted ports, and evidence references", () => {
    const record = typedFailureRecord({
      provenance: {
        eventIds: ["event-42"],
        effectIds: ["effect-7"],
        toolIdentity: "tool/db-adapter",
        toolVersion: "3.4.1",
        timestamps: ["2026-02-03T10:00:00Z", "2026-02-03T10:00:01Z"],
        evidenceRefs: ["ev-1", "ev-2"],
      },
      evidence: ["ev-1", "ev-2"],
    });
    const m = containedMachine(record);
    m.fire("assess_failure", { kind: "assessment", assessment: assessment() });
    // provenance supplied by the trusted port is retained verbatim after transitions
    expect(m.record?.provenance).toEqual(record.provenance);
    expect(m.record?.provenance?.eventIds).toEqual(["event-42"]);
    expect(m.record?.provenance?.effectIds).toEqual(["effect-7"]);
    expect(m.record?.provenance?.toolIdentity).toBe("tool/db-adapter");
    expect(m.record?.provenance?.toolVersion).toBe("3.4.1");
    expect(m.record?.provenance?.timestamps).toEqual(["2026-02-03T10:00:00Z", "2026-02-03T10:00:01Z"]);
    expect(m.record?.provenance?.evidenceRefs).toEqual(["ev-1", "ev-2"]);
    expect(m.record?.evidence).toEqual(["ev-1", "ev-2"]);
  });

  it("a lost-acknowledgement failure may assess no_effect once reconciliation supplies evidence", () => {
    // "timeout or transport failure ALONE cannot imply no_effect" — reconciliation evidence is the release
    const record = typedFailureRecord({ failureClass: "transport_failure" });
    const m = containedMachine(record);
    const r = m.fire("assess_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect", reconciliationEvidence: ["recon-1"] }),
    });
    expect(r.ok).toBe(true);
    expect(m.state).toBe("assessing");
    expect(m.fire("classify_known_failure", {
      kind: "assessment",
      assessment: assessment({ effectCertainty: "no_effect", reconciliationEvidence: ["recon-1"] }),
    }).ok).toBe(true);
    expect(m.state).toBe("known");
  });
});
