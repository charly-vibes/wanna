// Purpose: recovery property tests for the interaction runtime — persistence semantics, unknown effect, continuity checkpoints
// Responsibilities: the persistence/fault-injection corpus properties as vitest tests; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-runtime/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import {
  createInteractionRuntime,
  envelopeValid,
} from "../../src/interaction-runtime/index";
import type {
  CommitResult,
  PersistencePort,
} from "../../src/interaction-runtime/index";
import { SCHEMA_VERSION, POLICY_VERSION } from "../../src/interaction-runtime/index";
import { initialCommitted, rejectionOf, validEvent } from "./fixtures";

interface InjectionPort extends PersistencePort {
  readonly attempts: number;
  heal(): void;
}

function injectionPort(failAt: number, acknowledged: boolean, semantics: PersistencePort["semantics"] = "atomic"): InjectionPort {
  let count = 0;
  let disabled = false;
  return {
    name: "fault-injection",
    semantics,
    get attempts() {
      return count;
    },
    heal: () => {
      disabled = true;
    },
    commit(): CommitResult {
      count += 1;
      if (!disabled && count === failAt) {
        return { ok: false, acknowledged, error: `injected failure at commit boundary ${count}` };
      }
      return { ok: true };
    },
  };
}

describe("interaction-runtime recovery properties", () => {
  it("TypeScript test: injected failure at every commit boundary obeys the declared atomic or weaker recovery contract without silent double application", () => {
    for (const acknowledged of [true, false]) {
      for (const failAt of [1, 2, 3]) {
        const port = injectionPort(failAt, acknowledged);
        const rt = createInteractionRuntime(initialCommitted());
        rt.attachPersistence(port);
        let revision = 2;
        for (let i = 1; i < failAt; i++) {
          expect(rt.submit(validEvent({ eventId: `ev-ok-${i}`, interactionRevision: revision })).ok).toBe(true);
          revision += 1;
        }
        const before = rt.committed;
        const failing = rt.submit(validEvent({ eventId: "ev-fail", interactionRevision: revision }));
        expect(failing.ok).toBe(false);
        expect(rt.committed).toEqual(before);
        expect(rt.committed.appliedEventIds).not.toContain("ev-fail");
        expect(port.attempts).toBe(failAt);
        // recovery: the same event then applies exactly once
        port.heal();
        if (!acknowledged) {
          // unknown effect requires reconciliation before any retry
          expect(rt.submit(validEvent({ eventId: "ev-fail", interactionRevision: revision })).ok).toBe(false);
          rt.receiveStateSnapshot(before);
        }
        const healed = rt.submit(validEvent({ eventId: "ev-fail", interactionRevision: revision }));
        expect(healed.ok).toBe(true);
        expect(rt.committed.appliedEventIds.filter((id) => id === "ev-fail")).toHaveLength(1);
        expect(rt.committed.interactionRevision).toBe(before.interactionRevision + 1);
      }
    }
    // weaker semantics are declared, never silently claimed as exactly-once
    const weaker = injectionPort(1, true, "weaker-declared");
    const rt = createInteractionRuntime(initialCommitted());
    rt.attachPersistence(weaker);
    expect(rt.declaredSemantics).toBe("weaker-declared");
    expect(rt.submit(validEvent({ eventId: "ev-w1" })).ok).toBe(false);
    expect(rt.committed).toEqual(initialCommitted());
  });

  it("Fault-injection test: lost acknowledgement can yield unknown effect", () => {
    const port = injectionPort(1, false);
    const rt = createInteractionRuntime(initialCommitted());
    rt.attachPersistence(port);
    const r = rt.submit(validEvent());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("lost acknowledgement must not commit");
    expect(r.failure?.code).toBe("commit_acknowledgement_lost");
    expect(r.failure?.effectCertainty).toBe("unknown");
    expect(r.failure?.retryable).toBe(false);
    // the runtime assumes neither success nor failure: state unchanged, retry blocked
    expect(rt.committed).toEqual(initialCommitted());
    const retry = rt.submit(validEvent());
    if (!retry.ok) expect(rejectionOf(retry)).toContain("unknown_effect_blocks_retry");
    else throw new Error("unknown effect must block retry");
  });

  it("Property test: no unsafe retry path exists from unknown effect", () => {
    const port = injectionPort(1, false);
    const rt = createInteractionRuntime(initialCommitted());
    rt.attachPersistence(port);
    expect(rt.submit(validEvent()).ok).toBe(false);
    expect(rt.unknownEffect?.effectCertainty).toBe("unknown");
    // every mutating retry path is blocked while the effect is unknown
    const attempts: { name: string; result: { ok: boolean; reason?: string } }[] = [
      { name: "submit", result: rt.submit(validEvent()) },
      { name: "apply_current_event", result: rt.fire("apply_current_event") },
    ];
    for (const attempt of attempts) {
      expect(attempt.result.ok).toBe(false);
      if (!attempt.result.ok) {
        expect(attempt.result.reason).toContain("unknown_effect_blocks");
        expect(attempt.result.reason).toContain("reconcile");
      }
    }
    // claiming idempotency without proof is not a resolution
    expect(rt.resolveUnknownEffect(false).ok).toBe(false);
    const stillBlocked = rt.fire("apply_current_event");
    if (!stillBlocked.ok) expect(rejectionOf(stillBlocked)).toContain("unknown_effect_blocks");
    else throw new Error("apply must stay blocked without proven idempotency");
    // proven idempotency unblocks the retry — the event then applies exactly once
    expect(rt.resolveUnknownEffect(true).ok).toBe(true);
    expect(rt.submit(validEvent()).ok).toBe(true);
    expect(rt.committed.appliedEventIds.filter((id) => id === "ev-1")).toHaveLength(1);
    // the retire path is blocked the same way when the unknown effect arose on a lifecycle commit
    const portLifecycle = injectionPort(1, false);
    const rtl = createInteractionRuntime(initialCommitted());
    rtl.attachPersistence(portLifecycle);
    expect(rtl.submit(validEvent({ eventType: "cancel" })).ok).toBe(false);
    expect(rtl.unknownEffect?.effectCertainty).toBe("unknown");
    const retireBlocked = rtl.fire("retire_interaction", validEvent({ eventType: "cancel" }));
    expect(retireBlocked.ok).toBe(false);
    if (!retireBlocked.ok) expect(retireBlocked.reason).toContain("unknown_effect_blocks");
    // reconciliation via a refreshed committed-state snapshot is the other resolution path
    const port2 = injectionPort(1, false);
    const rt2 = createInteractionRuntime(initialCommitted());
    rt2.attachPersistence(port2);
    expect(rt2.submit(validEvent()).ok).toBe(false);
    rt2.receiveStateSnapshot(initialCommitted());
    expect(rt2.unknownEffect).toBeNull();
    expect(rt2.submit(validEvent()).ok).toBe(true);
    expect(rt2.committed.appliedEventIds.filter((id) => id === "ev-1")).toHaveLength(1);
  });

  it("suspension or recoverable interruption records the continuity checkpoint required to reorient and reconcile on resume", () => {
    const initial = initialCommitted();
    const rt = createInteractionRuntime(initial);
    expect(rt.submit(validEvent({ eventId: "ev-1", interactionRevision: 2 })).ok).toBe(true);
    expect(rt.submit(validEvent({ eventId: "ev-2", interactionRevision: 3 })).ok).toBe(true);
    const checkpoint = rt.suspend("recoverable interruption");
    expect(checkpoint.reason).toBe("recoverable interruption");
    expect(checkpoint.schemaVersion).toBe(SCHEMA_VERSION);
    expect(checkpoint.policyVersion).toBe(POLICY_VERSION);
    expect(checkpoint.interactionRevision).toBe(rt.committed.interactionRevision);
    expect(checkpoint.taskRevision).toBe(rt.committed.taskRevision);
    expect(checkpoint.appliedEventIds).toEqual(["ev-0", "ev-1", "ev-2"]);
    expect(checkpoint.retired).toBe(false);
    // resume reconciles against the committed state the checkpoint was taken from
    expect(rt.resume(checkpoint).ok).toBe(true);
    // a stale checkpoint is refused with the reconcile instruction
    const stale = { ...checkpoint, interactionRevision: 1 };
    const refused = rt.resume(stale);
    expect(refused.ok).toBe(false);
    expect(rejectionOf(refused)).toBe("checkpoint does not match committed state: reconcile before resume");
    // envelope validation still binds every event, and the runtime stays host-neutral
    expect(envelopeValid(validEvent()).ok).toBe(true);
  });
});
