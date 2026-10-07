// Purpose: interaction-need state machine
// Responsibilities: the five transitions (validate, reject, normalize, preserve-unresolved, retry) with their guards
// Rationale: unresolved is an explicit outcome — the normalizer never invents facts to force resolution
import type {
  NeedProposal,
  NeedState,
  NormalizedNeed,
  TransitionId,
  TransitionResult,
  UnresolvedNeed,
} from "./types";
import { TAXONOMY_VERSION } from "./types";
import { needSchemaValid, needTargetImmediate, unresolvedRequiresChange } from "./invariants";

export const NORMALIZER_VERSION = "interaction-need-normalizer@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: NeedState;
  readonly to: NeedState;
}

export const NEED_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_need", from: "proposed", to: "validating" },
  { id: "reject_invalid_need", from: "proposed", to: "rejected" },
  { id: "normalize_need", from: "validating", to: "normalized" },
  { id: "preserve_unresolved_need", from: "validating", to: "unresolved" },
  { id: "retry_unresolved", from: "unresolved", to: "proposed" },
];

export interface NeedNormalizer {
  readonly proposal: NeedProposal;
  readonly state: NeedState;
  readonly normalized: NormalizedNeed | null;
  readonly unresolvedRecord: UnresolvedNeed | null;
  readonly rejectionReason: string | null;
  fire(id: TransitionId): TransitionResult;
  retry(next: NeedProposal): TransitionResult;
}

interface Internals {
  state: NeedState;
  proposal: NeedProposal;
  normalized: NormalizedNeed | null;
  unresolvedRecord: UnresolvedNeed | null;
  rejectionReason: string | null;
}

function buildNormalized(proposal: NeedProposal): NormalizedNeed {
  return {
    kind: proposal.kind as NormalizedNeed["kind"],
    taxonomyVersion: TAXONOMY_VERSION,
    target: proposal.target as string,
    taskRevision: proposal.taskRevision,
    proposalId: proposal.proposalId,
    evidenceRefs: [...proposal.evidenceRefs],
    normalizedBy: NORMALIZER_VERSION,
    advisoryConfidence: proposal.confidence,
  };
}

function buildUnresolved(proposal: NeedProposal, why: string): UnresolvedNeed {
  return {
    kind: proposal.kind,
    target: proposal.target,
    taskRevision: proposal.taskRevision,
    proposalId: proposal.proposalId,
    evidenceRefs: [...proposal.evidenceRefs],
    reason: why,
  };
}

function guardHolds(id: TransitionId, proposal: NeedProposal): TransitionResult {
  if (id === "validate_need") return needSchemaValid(proposal);
  if (id === "reject_invalid_need") {
    const check = needSchemaValid(proposal);
    return check.ok ? { ok: false, reason: "reject_invalid_need requires an invalid need" } : { ok: true };
  }
  if (id === "normalize_need") {
    return needTargetImmediate(proposal)
      ? { ok: true }
      : { ok: false, reason: `guard need_target_immediate does not hold (evidence ${proposal.evidenceStrength}) — need remains unresolved` };
  }
  return needTargetImmediate(proposal)
    ? { ok: false, reason: "guard need_target_immediate holds — there is nothing to leave unresolved" }
    : { ok: true };
}

function applyEffect(internals: Internals, id: TransitionId, proposal: NeedProposal): void {
  if (id === "validate_need") {
    internals.state = "validating";
    return;
  }
  if (id === "reject_invalid_need") {
    internals.state = "rejected";
    internals.rejectionReason = needSchemaValid(proposal).reason ?? "invalid need";
    return;
  }
  if (id === "normalize_need") {
    internals.state = "normalized";
    internals.normalized = buildNormalized(proposal);
    return;
  }
  internals.state = "unresolved";
  internals.unresolvedRecord = buildUnresolved(
    proposal,
    `need_target_immediate does not hold (evidence ${proposal.evidenceStrength})`,
  );
}

function fireTransition(internals: Internals, id: TransitionId): TransitionResult {
  const row = NEED_TRANSITIONS.find((r) => r.id === id && r.id !== "retry_unresolved");
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(id, internals.proposal);
  if (!guard.ok) return guard;
  applyEffect(internals, id, internals.proposal);
  return { ok: true };
}

function retryTransition(internals: Internals, next: NeedProposal): TransitionResult {
  if (internals.state !== "unresolved") {
    return { ok: false, reason: `transition retry_unresolved cannot fire from state ${internals.state}` };
  }
  const record = internals.unresolvedRecord;
  const check = record ? unresolvedRequiresChange(record, next) : { ok: false, reason: "no unresolved record" };
  if (!check.ok) return check;
  internals.proposal = next;
  internals.state = "proposed";
  internals.unresolvedRecord = null;
  return { ok: true };
}

function makeMachine(internals: Internals): NeedNormalizer {
  return {
    get proposal() {
      return internals.proposal;
    },
    get state() {
      return internals.state;
    },
    get normalized() {
      return internals.normalized;
    },
    get unresolvedRecord() {
      return internals.unresolvedRecord;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    fire: (id) => fireTransition(internals, id),
    retry: (next) => retryTransition(internals, next),
  };
}

export function createNeedNormalizer(proposal: NeedProposal): NeedNormalizer {
  const internals: Internals = {
    state: "proposed",
    proposal,
    normalized: null,
    unresolvedRecord: null,
    rejectionReason: null,
  };
  return makeMachine(internals);
}
