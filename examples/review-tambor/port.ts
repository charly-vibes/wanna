// Purpose: the demo's fault-injecting ReviewPersistencePort wrapper (wanna-72s)
// Responsibilities: delegate every port call to the inner port verbatim, except
//   while a fault is armed — then the next `count` commits answer with the
//   armed failure outcome without contacting the inner port; load and
//   reconcile always delegate (a demo fault targets the uncertain-commit path
//   only)
// Rationale: tambor-y9d.2 descope ruling — infrastructure explicitly allowed:
//   the lose-ack and storage-down fault buttons need a wrapper, and this is
//   NOT a semantics copy (the outcome types are the shell's own port contract;
//   the shell still decides what each outcome means)
import type {
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  PortReconcileOutcome,
  ReviewPersistencePort,
  SessionTaskKey,
} from "@wanna/composition-shell";

/** The faults the demo's buttons can arm. */
export type PortFault = "unavailable" | "unknown_effect";

/** A port that can be armed to fail its next commits with a typed fault. */
export interface FaultPort extends ReviewPersistencePort {
  /** arm `kind` for the next `count` commits */
  arm(kind: PortFault, count: number): void;
}

export function makeFaultPort(inner: ReviewPersistencePort): FaultPort {
  let kind: PortFault | null = null;
  let remaining = 0;
  const faulted = (): PortCommitOutcome => {
    const armed = kind;
    remaining -= 1;
    if (remaining === 0) kind = null;
    return armed === "unknown_effect"
      ? { kind: "unknown_effect" }
      : { kind: "unavailable" };
  };
  return {
    supportsAtomicCommitAndReplay: inner.supportsAtomicCommitAndReplay,
    deduplicationScope: inner.deduplicationScope,
    arm(next: PortFault, count: number): void {
      kind = next;
      remaining = count;
    },
    async load(key: SessionTaskKey): Promise<PortLoadOutcome> {
      return inner.load(key);
    },
    async compareAndCommit(
      key: SessionTaskKey,
      expectedVersion: number | null,
      operation: PortOperation,
    ): Promise<PortCommitOutcome> {
      if (kind !== null) return faulted();
      return inner.compareAndCommit(key, expectedVersion, operation);
    },
    async reconcile(
      key: SessionTaskKey,
      operationId: string,
    ): Promise<PortReconcileOutcome> {
      return inner.reconcile(key, operationId);
    },
  };
}
