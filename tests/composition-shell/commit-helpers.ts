// Purpose: shared harness helpers for the composition-shell commit contracts (wanna-8k6)
// Responsibilities: recording/fault-injecting port decorators, command factories and storage fingerprints used by commit.test.ts and commit-port.test.ts
// Rationale: extracted for pretender file-size limits; consumer-owned fakes come from ./consumer-support
import type {
  PortCommitOutcome,
  PortOperation,
  ReviewPersistencePort,
  SubmitEventCommand,
  UpdateArtifactCommand,
} from "../../src/composition-shell";
import * as shellApi from "../../src/composition-shell";
import {
  FakeReviewStore,
  FIRST_FEEDBACK,
  KEY,
  POLICY,
  CATALOG,
} from "./consumer-support";
/** Every compareAndCommit the shell makes, recorded verbatim for unit-level orchestration proofs. */
interface PortObservation {
  commits: number;
  ops: PortOperation[];
}

/** Frozen port shape: decorators return frozen facades over an inner port. */
function frozenPort(shape: ReviewPersistencePort): ReviewPersistencePort {
  return Object.freeze(shape);
}

/** Assigned port shape: commit behavior spliced over a pass-through facade. */
function assignedPort(
  inner: ReviewPersistencePort,
  commit: ReviewPersistencePort["compareAndCommit"],
): ReviewPersistencePort {
  const passthrough: ReviewPersistencePort = {
    supportsAtomicCommitAndReplay: inner.supportsAtomicCommitAndReplay,
    deduplicationScope: inner.deduplicationScope,
    load: (key) => inner.load(key),
    compareAndCommit: async () => {
      throw new Error("assignedPort requires an explicit commit behavior");
    },
    reconcile: (key, operationId) => inner.reconcile(key, operationId),
  };
  return Object.assign(passthrough, { compareAndCommit: commit });
}

export function recordingPort(
  inner: ReviewPersistencePort,
): { port: ReviewPersistencePort; observed: PortObservation } {
  const observed: PortObservation = { commits: 0, ops: [] };
  const port = frozenPort({
    supportsAtomicCommitAndReplay: inner.supportsAtomicCommitAndReplay,
    deduplicationScope: inner.deduplicationScope,
    load: (key) => inner.load(key),
    compareAndCommit: async (key, expectedVersion, operation) => {
      observed.commits += 1;
      observed.ops.push(operation);
      return inner.compareAndCommit(key, expectedVersion, operation);
    },
    reconcile: (key, operationId) => inner.reconcile(key, operationId),
  });
  return { port, observed };
}

/** Port whose commits always return one forced declared outcome (failure injection). */
export function forcedOutcomePort(
  inner: ReviewPersistencePort,
  forced: PortCommitOutcome,
): ReviewPersistencePort {
  return assignedPort(inner, async () => forced);
}

/** Port whose commits throw — a thrown commit can never mean certainly-not-applied. */
export function throwingCommitPort(inner: ReviewPersistencePort): ReviewPersistencePort {
  return assignedPort(
    inner,
    async () => {
      throw new Error("storage exploded mid-commit");
    },
  );
}

export async function openOn(port: ReviewPersistencePort) {
  const opened = await shellApi.openReviewSession({
    key: KEY,
    policy: POLICY,
    catalog: CATALOG,
    port,
  });
  if (opened.kind !== "ready")
    throw new Error(`expected ready open, got ${opened.kind}`);
  return opened.shell;
}

export function updateCommand(
  overrides: Partial<UpdateArtifactCommand>,
): UpdateArtifactCommand {
  return {
    operationId: "artifact-revision-8",
    expectedAggregateVersion: 1,
    revision: 8,
    contentRef: "artifact-1/revisions/8",
    ...overrides,
  };
}

export function submitCommand(
  overrides: Partial<SubmitEventCommand>,
): SubmitEventCommand {
  return {
    eventId: "feedback-7",
    interactionId: "artifact-1:interaction:1",
    expectedTaskRevision: 7,
    expectedInteractionRevision: 1,
    feedback: FIRST_FEEDBACK,
    ...overrides,
  };
}

/** Immutable storage view for no-mutation assertions (receipts counted separately). */
export function storageFingerprint(store: FakeReviewStore): string {
  const state = store.rawState(KEY);
  return JSON.stringify({
    aggregateVersion: state.aggregateVersion,
    replay: state.replay,
    receipts: [...state.receipts.values()],
  });
}