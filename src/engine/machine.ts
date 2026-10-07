// Purpose: the interaction-engine model state machine
// Responsibilities: 7 states, 8 transitions, guard enforcement, committed-decision preservation
// Rationale: table-driven rows mirroring [[spec]] ## Model; rejections never mutate committed state
import type {
  ContextSnapshot,
  DecisionResult,
  EngineState,
  Policy,
  RecordedTransition,
  RetireCommand,
  TransitionId,
  TransitionResult,
} from "./types";
import { contextSchemaValid } from "./context";
import { evaluate } from "./evaluate";

export interface EngineInternals {
  state: EngineState;
  snapshot: ContextSnapshot | undefined;
  policy: Policy | undefined;
  evaluatedRevision: number | undefined;
  currentRevision: number | undefined;
  committedDecision: DecisionResult | undefined;
  newSnapshotPending: boolean;
  retireCommand: string | undefined;
}

export interface EngineSurface {
  readonly state: EngineState;
  readonly log: readonly RecordedTransition[];
  readonly committedDecision: DecisionResult | undefined;
  acceptContext(ctx: ContextSnapshot, policy: Policy): TransitionResult;
  correctContext(): TransitionResult;
  evaluate(): TransitionResult;
  commit(): TransitionResult;
  retire(command?: RetireCommand): TransitionResult;
  /** Test/adapter hook: the task revision changed under the evaluated decision. */
  receiveRevisionBump(): void;
}

type Fire = (id: TransitionId) => TransitionResult;

/** One row per [[spec]] ## Model transition: id, from, to, guard. */
function transitionRows(t: EngineInternals): Record<TransitionId, { from: EngineState; to: EngineState; guard: () => boolean; why: string }> {
  const r = (from: EngineState, to: EngineState, guard: () => boolean, why: string) => ({ from, to, guard, why });
  return {
    accept_context: r("draft", "normalized", () => contextSchemaValid(t.snapshot!), "context_schema_valid does not hold"),
    reject_invalid_context: r("draft", "invalid_context", () => !contextSchemaValid(t.snapshot!), "context_schema_valid holds"),
    correct_invalid_context: r("invalid_context", "draft", () => t.newSnapshotPending, "corrected_context_received does not hold — no explicit new snapshot"),
    evaluate_pinned_context: r("normalized", "evaluated", () => t.snapshot!.catalogVersion.trim() !== "" && t.policy!.version.trim() !== "", "policy_catalog_versions_pinned does not hold"),
    commit_current_decision: r("evaluated", "committed", () => t.evaluatedRevision === t.currentRevision, "context_version_current does not hold — revision moved under the evaluated decision"),
    reject_stale_decision: r("evaluated", "stale_context", () => t.evaluatedRevision !== t.currentRevision, "context_version_current holds"),
    refresh_stale_context: r("stale_context", "draft", () => t.newSnapshotPending, "corrected_context_received does not hold — no explicit new snapshot"),
    retire_committed_decision: r("committed", "retired", () => (t.retireCommand ?? "").trim() !== "", "retirement_requested does not hold — no explicit retire/cancel/supersede/expiry command"),
  };
}

/** Context lifecycle: accept (or reject), and corrected re-entry from invalid/stale. */
function contextLifecycle(t: EngineInternals, fire: Fire) {
  function acceptContext(ctx: ContextSnapshot, policy: Policy): TransitionResult {
    t.snapshot = ctx;
    t.policy = policy;
    t.currentRevision = ctx.taskRevision;
    t.newSnapshotPending = true;
    // A corrected snapshot re-enters draft via [[spec.corrected_context_received]] first.
    if (t.state === "invalid_context") {
      const r = fire("correct_invalid_context");
      if (!r.ok) return r;
    } else if (t.state === "stale_context") {
      const r = fire("refresh_stale_context");
      if (!r.ok) return r;
    }
    const r = fire(contextSchemaValid(ctx) ? "accept_context" : "reject_invalid_context");
    if (r.ok) t.newSnapshotPending = false;
    return r;
  }
  return { acceptContext };
}

/** Decision lifecycle: evaluate, commit (or refuse as stale), retire. */
function decisionLifecycle(t: EngineInternals, fire: Fire) {
  return {
    evaluate(): TransitionResult {
      if (!t.snapshot || !t.policy) return { ok: false, reason: "evaluate: no accepted context" };
      const r = fire("evaluate_pinned_context");
      if (r.ok) t.evaluatedRevision = t.currentRevision;
      return r;
    },
    commit(): TransitionResult {
      if (t.evaluatedRevision === t.currentRevision) {
        const r = fire("commit_current_decision");
        if (r.ok && t.snapshot && t.policy) {
          const evaluation = evaluate(t.snapshot, t.policy);
          if (evaluation.ok) t.committedDecision = evaluation.value;
        }
        return r;
      }
      // stale: refusal IS the reject_stale_decision transition; committed state untouched
      return fire("reject_stale_decision");
    },
    retire(command?: RetireCommand): TransitionResult {
      t.retireCommand = command?.kind;
      return fire("retire_committed_decision");
    },
  };
}

export function newInternals(): EngineInternals {
  return {
    state: "draft",
    snapshot: undefined,
    policy: undefined,
    evaluatedRevision: undefined,
    currentRevision: undefined,
    committedDecision: undefined,
    newSnapshotPending: false,
    retireCommand: undefined,
  };
}

export function createEngine(): EngineSurface {
  const t = newInternals();
  const rows = transitionRows(t);
  const log: RecordedTransition[] = [];
  const fire: Fire = (id) => {
    const row = rows[id];
    if (t.state !== row.from) return { ok: false, reason: `${id}: expected state ${row.from}, found ${t.state}` };
    if (!row.guard()) return { ok: false, reason: `${id}: guard failed — ${row.why}` };
    t.state = row.to;
    log.push({ id, from: row.from, to: row.to });
    return { ok: true };
  };
  const correctContext = () => fire(t.state === "invalid_context" ? "correct_invalid_context" : "refresh_stale_context");
  const receiveRevisionBump = () => {
    if (t.currentRevision !== undefined) t.currentRevision += 1;
  };
  return {
    get state() {
      return t.state;
    },
    get log() {
      return log;
    },
    get committedDecision() {
      return t.committedDecision;
    },
    ...contextLifecycle(t, fire),
    ...decisionLifecycle(t, fire),
    correctContext,
    receiveRevisionBump,
  };
}