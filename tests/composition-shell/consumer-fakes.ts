// Purpose: shared consumer-owned support for the composition-shell consumer behavior contracts
// Responsibilities: in-memory fake durable store/port built purely from declared public port types, the behavior-landed probe, and the scenario harness helpers used by the split consumer suites
// Rationale: openspec/changes/add-composition-shell/consumer-example.md; extracted from the wanna-9wu consumer-behavior contract to satisfy pretender file/function limits without behavior change
// GUARD DESIGN (wanna-8k6, option b — split probes):
// Behavioral consumer tests are SKIP-GUARDED by one-time probes. Skipped-while-
// unimplemented is the DEFERRED-EVIDENCE state, never behavioral evidence. The
// probes flip as behavior lands and are REMOVED at wanna-gcp completion:
//
// - coreBehaviorLanded — true exactly when the full first path
//   (open → updateArtifact → evaluateNeed → commitDecision → submit → recorded)
//   works on a healthy fake port. Owned by wanna-0te + wanna-15e + wanna-8k6.
//   Enables the happy-path consumer tests: first-review, stale-decision,
//   stale-response, duplicate-delivery, restart, shared-writers,
//   unsupported-or-empty — plus new-review and incompatible-storage, which
//   pass incidentally through 8k6's revision-bound commits and the 0te open
//   path (wanna-gcp still owns supersession and recovery semantics).
//   Unit-level duplicate/conflict evidence lives in commit.test.ts; the
//   durable browser-level shared-store proof is separately required by
//   wanna-9r2.
// - reconcileBehaviorLanded — true when `reconcile` returns a typed outcome
//   instead of its stub error (wanna-gcp). Enables lost-acknowledgement,
//   which additionally needs mutation blocking between unknown_effect and
//   reconciliation ([[composition.shell.uncertain_effect_blocks_mutation]]).
// - cancelBehaviorLanded — true when the explicit cancel/retire command
//   exists on the shell surface (wanna-gcp). Enables cancel-after-display.
//
// Forcing a guard must produce ONLY missing-behavior failures — see
// .wai/projects/wanna/research/2026-10-10-9wu-red-evidence.md.
//
// Test-port interpretation contract (consumer-owned):
// - The shell owns its `stateChanges` vocabulary (typed `unknown` at the public
//   surface). The fake port stores operations verbatim in the replay and applies
//   a shallow merge, tracking the authoritative task revision by the
//   `taskRevision` (fallback `revision`) field name. If the landed behavior
//   uses a different vocabulary, the owning ticket updates this fake
//   explicitly — this file IS the handoff contract.
// - `expectedVersion === null` means create-only (the aggregate must not exist
//   yet), matching consumer-example.md's initial compare-and-commit.
// - Fault controls (lost acknowledgement, incompatible storage) are injected at
//   the port boundary using only the declared port outcome types.
//
// Known surface gap recorded for the owning tickets: the scaffolded public
// surface does not yet declare the explicit retire/cancel command
// ([[composition.shell.retire_only_explicit]]). The cancel-after-display test
// asserts through the minimal consumer-visible extension `ExplicitCancelShell`
// below; wanna-gcp must align the consumer suites with the landed command shape.
import type {
  AggregateSnapshot,
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  PortReconcileOutcome,
  ReviewCatalog,
  ReviewPersistencePort,
  ReviewPolicy,
  SessionTaskKey,
} from "../../src/composition-shell";


export const KEY: SessionTaskKey = { sessionId: "session-1", taskId: "artifact-1" };
export const POLICY: ReviewPolicy = { policyVersion: "policy-1" };
export const CATALOG: ReviewCatalog = { catalogVersion: "catalog-1" };
export const FIRST_FEEDBACK = "The explanation needs one concrete example.";

export interface StoredState {
  aggregateVersion: number; // 0 = nothing persisted yet
  taskRevision: number; // 0 = no artifact revision yet
  replay: unknown[];
  receipts: Map<string, { operationId: string; applied: boolean }>;
}

export interface StoreConfig {
  /** operation ids whose durable commit succeeds but whose acknowledgement is lost (declared `unknown_effect`). */
  readonly ackLoss: Set<string>;
  /** when set, `load()` short-circuits into this outcome (incompatible-storage simulation). */
  loadOverride?: PortLoadOutcome;
  /** when true, the next compareAndCommit applies durably but loses its acknowledgement. */
  loseNextAck: boolean;
}

/**
 * Consumer-owned fake durable store. One store can serve several ports
 * (shared writers, restart) and records every committed operation verbatim so
 * a reconstructed shell can replay its own vocabulary.
 */
export class FakeReviewStore {
  readonly config: StoreConfig = { ackLoss: new Set(), loseNextAck: false };
  private readonly states = new Map<string, StoredState>();

  state(key: SessionTaskKey): StoredState {
    const id = `${key.sessionId}/${key.taskId}`;
    let state = this.states.get(id);
    if (!state) {
      state = {
        aggregateVersion: 0,
        taskRevision: 0,
        replay: [],
        receipts: new Map(),
      };
      this.states.set(id, state);
    }
    return state;
  }

  /** Direct observation of persisted data, bypassing the port outcome types. */
  rawState(key: SessionTaskKey): StoredState {
    return this.state(key);
  }

  loseAckFor(operationId: string): void {
    this.config.ackLoss.add(operationId);
  }

  loseNextAck(): void {
    this.config.loseNextAck = true;
  }

  setLoadOverride(outcome: PortLoadOutcome): void {
    this.config.loadOverride = outcome;
  }

  port(key: SessionTaskKey): ReviewPersistencePort {
    return new FakePort(this, key);
  }

  static snapshot(state: StoredState): AggregateSnapshot {
    return {
      aggregateVersion: state.aggregateVersion,
      taskRevision: state.taskRevision,
      replay: [...state.replay],
      receipts: [...state.receipts.values()],
    };
  }
}

export class FakePort implements ReviewPersistencePort {
  readonly supportsAtomicCommitAndReplay = true;
  constructor(
    private readonly store: FakeReviewStore,
    private readonly key: SessionTaskKey,
  ) {}

  get deduplicationScope(): ReadonlySet<string> {
    return new Set([this.key.sessionId]);
  }

  async load(): Promise<PortLoadOutcome> {
    if (this.store.config.loadOverride) return this.store.config.loadOverride;
    const state = this.store.state(this.key);
    if (state.aggregateVersion === 0) return { kind: "not_found" };
    return { kind: "loaded", snapshot: FakeReviewStore.snapshot(state) };
  }

  async compareAndCommit(
    _key: SessionTaskKey,
    expectedVersion: number | null,
    operation: PortOperation,
  ): Promise<PortCommitOutcome> {
    const state = this.store.state(this.key);
    const duplicate = this.findDuplicate(state, operation.operationId);
    if (duplicate) return duplicate;
    if (this.ackIsLost(operation.operationId)) {
      this.apply(state, operation);
      return { kind: "unknown_effect" };
    }
    return this.commitChecked(state, expectedVersion, operation);
  }

  async reconcile(
    _key: SessionTaskKey,
    operationId: string,
  ): Promise<PortReconcileOutcome> {
    const state = this.store.state(this.key);
    const receipt = state.receipts.get(operationId);
    if (receipt && receipt.applied) {
      return {
        kind: "applied",
        receipt,
        snapshot: FakeReviewStore.snapshot(state),
      };
    }
    return { kind: "not_applied" };
  }

  private findDuplicate(
    state: StoredState,
    operationId: string,
  ): PortCommitOutcome | undefined {
    const existing = state.receipts.get(operationId);
    return existing ? { kind: "duplicate", receipt: existing } : undefined;
  }

  /** Durable side effect: consumes the pending lose-next-ack fault if set. */
  private ackIsLost(operationId: string): boolean {
    const lost =
      this.store.config.ackLoss.has(operationId) ||
      this.store.config.loseNextAck;
    this.store.config.loseNextAck = false;
    return lost;
  }

  private commitChecked(
    state: StoredState,
    expectedVersion: number | null,
    operation: PortOperation,
  ): PortCommitOutcome {
    if (!this.preconditionMet(state, expectedVersion)) {
      return { kind: "conflict" };
    }
    this.apply(state, operation);
    const receipt = state.receipts.get(operation.operationId);
    if (!receipt)
      throw new Error(
        "fake port invariant violated: receipt missing after apply",
      );
    return {
      kind: "applied",
      receipt,
      snapshot: FakeReviewStore.snapshot(state),
    };
  }

  private preconditionMet(
    state: StoredState,
    expectedVersion: number | null,
  ): boolean {
    if (expectedVersion === null) return state.aggregateVersion === 0;
    return state.aggregateVersion === expectedVersion;
  }

  private apply(state: StoredState, operation: PortOperation): void {
    const revision = pickNumber(
      operation.stateChanges,
      "taskRevision",
      "revision",
    );
    if (revision !== undefined) state.taskRevision = revision;
    state.aggregateVersion += 1;
    state.replay.push(
      {
        operationId: operation.operationId,
        stateChanges: operation.stateChanges,
      },
      ...operation.replayAdditions,
    );
    state.receipts.set(operation.operationId, {
      operationId: operation.operationId,
      applied: true,
    });
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pickNumber(
  source: unknown,
  ...fieldNames: string[]
): number | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const record = source as Record<string, unknown>;
  const candidates = fieldNames.map((name) => record[name]);
  return candidates.find(isFiniteNumber);
}
