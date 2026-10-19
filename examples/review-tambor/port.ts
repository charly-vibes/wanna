// Purpose: the demo's fault-injecting ReviewPersistencePort wrapper (wanna-72s)
// Responsibilities: delegate every port call to the inner port verbatim, except
//   while a fault is armed — then the next `count` commits answer with the
//   armed failure outcome: `unavailable` fails WITHOUT contacting the inner
//   port (an unanswerable write), while `unknown_effect` DELEGATES the commit
//   to the inner port and suppresses its successful acknowledgement — the
//   committed-but-unacknowledged risk the demo's Lose-ack button advertises
//   (wanna-5xi). Load and reconcile always delegate (a demo fault targets the
//   uncertain-commit path only).
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
  const consume = (): PortFault => {
    const armed = kind as PortFault;
    remaining -= 1;
    if (remaining === 0) kind = null;
    return armed;
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
      if (kind === null)
        return inner.compareAndCommit(key, expectedVersion, operation);
      if (consume() === "unavailable") return { kind: "unavailable" };
      // lost ack: the write lands in storage, only its acknowledgement is
      // suppressed — whatever the inner port answered, the caller's outcome
      // is unknown (the reconciliation decides the truth)
      await inner.compareAndCommit(key, expectedVersion, operation);
      return { kind: "unknown_effect" };
    },
    async reconcile(
      key: SessionTaskKey,
      operationId: string,
    ): Promise<PortReconcileOutcome> {
      return inner.reconcile(key, operationId);
    },
  };
}
