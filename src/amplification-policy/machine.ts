// Purpose: interaction amplification policy state machine
// Responsibilities: the six [[spec]] transitions with their guards, the decision record, and context re-proposal
// Rationale: the policy is deterministic after normalization — guards fail with exact reason codes, never silently
import { evaluateCandidates } from "./evaluate";
import { contextDigest } from "./invariants";
import type {
  AmplificationCandidate,
  AmplificationDecision,
  AmplificationState,
  NormalizedContext,
  PolicyContext,
  TransitionId,
  TransitionResult,
} from "./types";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: AmplificationState;
  readonly to: AmplificationState;
}

export const AMPLIFICATION_TRANSITIONS: readonly TransitionRow[] = [
  { id: "normalize_context", from: "received", to: "normalized" },
  { id: "evaluate_candidates", from: "normalized", to: "evaluated" },
  { id: "select_candidate", from: "evaluated", to: "selected" },
  { id: "return_no_candidate", from: "evaluated", to: "no_candidate" },
  { id: "reject_stale_context", from: "evaluated", to: "stale" },
  { id: "recompute_new_context", from: "stale", to: "received" },
];

export interface AmplificationPolicyMachine {
  readonly state: AmplificationState;
  readonly normalized: NormalizedContext | null;
  readonly decision: AmplificationDecision | null;
  fire(id: TransitionId): TransitionResult;
  proposeContext(next: PolicyContext): void;
}

interface Internals {
  state: AmplificationState;
  context: PolicyContext;
  candidates: readonly AmplificationCandidate[];
  normalized: NormalizedContext | null;
  pendingContext: PolicyContext | null;
  decision: AmplificationDecision | null;
}

function normalize(i: Internals): TransitionResult {
  if (i.context.policyVersion.length === 0) {
    return { ok: false, reason: "guard deterministic_after_normalization fails: context does not pin a policy version" };
  }
  if (i.context.catalogVersion.length === 0) {
    return { ok: false, reason: "guard deterministic_after_normalization fails: context does not pin a catalog version" };
  }
  return { ok: true };
}

function evaluate(i: Internals): TransitionResult {
  if (!i.normalized) return { ok: false, reason: "guard risk_floor_preserved fails: no normalized context" };
  const r = evaluateCandidates(i.context, i.candidates, i.normalized.digest);
  if (!r.ok) return { ok: false, reason: r.reason ?? "guard risk_floor_preserved fails" };
  return { ok: true };
}

function select(i: Internals): TransitionResult {
  const d = i.decision;
  if (!d) return { ok: false, reason: "guard least_burden_candidate fails: no evaluated decision" };
  if (d.eligible.length === 0) {
    return { ok: false, reason: "guard least_burden_candidate fails: no eligible candidate to select" };
  }
  i.decision = {
    ...d,
    outcome: "selected",
    selected: [{ id: d.eligible[0]!, reasonCode: "selected_least_burden" }],
  };
  return { ok: true };
}

function noInteractionReason(i: Internals): string | null {
  const clauses: string[] = [];
  if (i.context.requiresHumanContribution) {
    clauses.push("a human contribution is still required");
  }
  if (i.context.authorityGates.length > 0) {
    clauses.push(`an unresolved authority gate remains: ${i.context.authorityGates.join(", ")}`);
  }
  if (i.context.verificationGates.length > 0) {
    clauses.push(`an unresolved verification gate remains: ${i.context.verificationGates.join(", ")}`);
  }
  if (clauses.length === 0) return null;
  return `guard no_interaction_when_not_needed fails: ${clauses.join("; ")}`;
}

function noCandidate(i: Internals): TransitionResult {
  const reason = noInteractionReason(i);
  if (reason) return { ok: false, reason };
  if (i.decision) i.decision = { ...i.decision, outcome: "no_candidate" };
  return { ok: true };
}

function rejectStale(i: Internals): TransitionResult {
  const pending = i.pendingContext;
  if (!pending || !i.normalized || contextDigest(pending) === i.normalized.digest) {
    return {
      ok: false,
      reason: "guard ¬deterministic_after_normalization fails: normalized context is unchanged since evaluation",
    };
  }
  return { ok: true };
}

function recompute(i: Internals): TransitionResult {
  const d = i.decision;
  const entries = d ? d.selected.length + d.exclusions.length + d.eligible.length : 0;
  const recorded = entries > 0 || d?.outcome === "no_candidate";
  if (!recorded) {
    return {
      ok: false,
      reason: "guard decision_reasons_stable fails: last decision record carries no reason-coded selections or exclusions",
    };
  }
  return { ok: true };
}

const GUARDS: Record<TransitionId, (i: Internals) => TransitionResult> = {
  normalize_context: normalize,
  evaluate_candidates: evaluate,
  select_candidate: select,
  return_no_candidate: noCandidate,
  reject_stale_context: rejectStale,
  recompute_new_context: recompute,
};

function buildNormalized(i: Internals): void {
  i.normalized = {
    taskRevision: i.context.taskRevision,
    policyVersion: i.context.policyVersion,
    catalogVersion: i.context.catalogVersion,
    riskClass: i.context.riskClass,
    evidenceState: i.context.evidenceState,
    digest: contextDigest(i.context),
  };
}

const EFFECTS: Record<TransitionId, (i: Internals) => void> = {
  normalize_context: (i) => {
    buildNormalized(i);
    i.state = "normalized";
  },
  evaluate_candidates: (i) => {
    const r = evaluateCandidates(i.context, i.candidates, i.normalized!.digest);
    i.decision = r.decision ?? null;
    i.state = "evaluated";
  },
  select_candidate: (i) => {
    i.state = "selected";
  },
  return_no_candidate: (i) => {
    i.state = "no_candidate";
  },
  reject_stale_context: (i) => {
    i.state = "stale";
  },
  recompute_new_context: (i) => {
    if (i.pendingContext) i.context = i.pendingContext;
    i.pendingContext = null;
    i.normalized = null;
    i.decision = null;
    i.state = "received";
  },
};

function makeMachine(internals: Internals): AmplificationPolicyMachine {
  return {
    get state() {
      return internals.state;
    },
    get normalized() {
      return internals.normalized;
    },
    get decision() {
      return internals.decision;
    },
    fire: (id) => {
      const row = AMPLIFICATION_TRANSITIONS.find((r) => r.id === id);
      if (!row) return { ok: false, reason: `unknown transition ${id}` };
      if (internals.state !== row.from) {
        return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
      }
      const guard = GUARDS[id](internals);
      if (!guard.ok) return guard;
      EFFECTS[id](internals);
      return { ok: true };
    },
    proposeContext: (next) => {
      internals.pendingContext = next;
    },
  };
}

export function createAmplificationPolicy(
  ctx: PolicyContext,
  candidates: readonly AmplificationCandidate[],
): AmplificationPolicyMachine {
  const internals: Internals = {
    state: "received",
    context: ctx,
    candidates,
    normalized: null,
    pendingContext: null,
    decision: null,
  };
  return makeMachine(internals);
}
