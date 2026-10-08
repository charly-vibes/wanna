// Purpose: capability-lifecycle state machine
// Responsibilities: the seven transitions (inspect, preview, evaluate, approve, register, reject, retire) plus invoke and restore, with audit history
// Rationale: a candidate only becomes the active revision after every gate for its risk class holds; failures are explicit and recoverable
import type {
  AuditEntry,
  CapabilityProposal,
  Check,
  InvokeRequest,
  LifecycleState,
  LifecycleTransitionId,
  TransitionResult,
} from "./types";
import {
  acceptanceRequiresGate,
  compositionIsBounded,
  failedCandidateNotActive,
  goalAndSafetySeparate,
  invokeIsExistingUse,
  previewIsNonCommitting,
  proposalInspectable,
  retirementAndRecoverySupported,
} from "./invariants";

export interface TransitionRow {
  readonly id: LifecycleTransitionId;
  readonly from: LifecycleState;
  readonly to: LifecycleState;
}

export const LIFECYCLE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "inspect_candidate", from: "proposed", to: "inspected" },
  { id: "preview_candidate", from: "inspected", to: "previewed" },
  { id: "evaluate_candidate", from: "previewed", to: "evaluated" },
  { id: "approve_candidate", from: "evaluated", to: "approved" },
  { id: "register_candidate", from: "approved", to: "registered" },
  { id: "reject_candidate", from: "evaluated", to: "rejected" },
  { id: "retire_capability", from: "registered", to: "retired" },
];

export interface LifecycleMachine {
  readonly proposal: CapabilityProposal;
  readonly state: LifecycleState;
  readonly activeRevision: string | null;
  readonly acceptedRevisions: readonly string[];
  readonly history: readonly AuditEntry[];
  readonly rejectionReason: string | null;
  readonly lastFailure: string | null;
  fire(id: LifecycleTransitionId): TransitionResult;
  invoke(request: InvokeRequest): Check;
  restore(revision: string): TransitionResult;
}

interface Internals {
  state: LifecycleState;
  proposal: CapabilityProposal;
  activeRevision: string | null;
  acceptedRevisions: string[];
  history: AuditEntry[];
  rejectionReason: string | null;
  lastFailure: string | null;
}

function registerGuard(proposal: CapabilityProposal, acceptedRevisions: readonly string[]): Check {
  const failed = failedCandidateNotActive(proposal);
  if (!failed.ok) return failed;
  if (proposal.composition) {
    return compositionIsBounded(proposal.composition, acceptedRevisions);
  }
  return { ok: true };
}

function negatedFailedCandidate(proposal: CapabilityProposal): Check {
  if (failedCandidateNotActive(proposal).ok) {
    return {
      ok: false,
      reason: "guard ¬failed_candidate_not_active does not hold: the candidate passed all required gates for its risk class",
    };
  }
  return { ok: true };
}

function guardFor(
  id: LifecycleTransitionId,
  proposal: CapabilityProposal,
  acceptedRevisions: readonly string[],
): Check {
  if (id === "inspect_candidate") return proposalInspectable(proposal);
  if (id === "preview_candidate") return previewIsNonCommitting(proposal.preview);
  if (id === "evaluate_candidate") return goalAndSafetySeparate(proposal.evaluation);
  if (id === "approve_candidate") return acceptanceRequiresGate(proposal);
  if (id === "register_candidate") return registerGuard(proposal, acceptedRevisions);
  if (id === "reject_candidate") return negatedFailedCandidate(proposal);
  return retirementAndRecoverySupported(acceptedRevisions);
}

function refuse(internals: Internals, reason: string): TransitionResult {
  internals.lastFailure = reason;
  return { ok: false, reason };
}

function applyEffect(internals: Internals, id: LifecycleTransitionId): void {
  const row = LIFECYCLE_TRANSITIONS.find((r) => r.id === id) as TransitionRow;
  const entry: AuditEntry = {
    transition: id,
    from: internals.state,
    to: row.to,
    revision: internals.proposal.revision,
  };
  internals.history = [...internals.history, entry];
  if (id === "register_candidate") {
    internals.activeRevision = internals.proposal.revision;
    internals.acceptedRevisions = [...internals.acceptedRevisions, internals.proposal.revision];
  }
  if (id === "reject_candidate") {
    internals.rejectionReason = failedCandidateNotActive(internals.proposal).reason ?? "candidate failed";
  }
  internals.state = row.to;
}

function fireTransition(internals: Internals, id: LifecycleTransitionId): TransitionResult {
  const row = LIFECYCLE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return refuse(internals, `unknown transition ${id}`);
  if (internals.state !== row.from) {
    return refuse(internals, `transition ${id} cannot fire from state ${internals.state}`);
  }
  const guard = guardFor(id, internals.proposal, internals.acceptedRevisions);
  if (!guard.ok) return refuse(internals, guard.reason);
  applyEffect(internals, id);
  internals.lastFailure = null;
  return { ok: true };
}

function invokeCapability(internals: Internals, request: InvokeRequest): Check {
  const check = invokeIsExistingUse(internals.state, request);
  if (!check.ok) {
    internals.lastFailure = check.reason;
    return check;
  }
  const entry: AuditEntry = {
    transition: "invoke",
    from: internals.state,
    to: internals.state,
    revision: internals.proposal.revision,
  };
  internals.history = [...internals.history, entry];
  return { ok: true };
}

function restoreRevision(internals: Internals, revision: string): TransitionResult {
  if (internals.state !== "registered" && internals.state !== "retired") {
    return refuse(internals, `transition restore cannot fire from state ${internals.state}`);
  }
  if (!internals.acceptedRevisions.includes(revision)) {
    return refuse(internals, `restore revision ${revision} cannot be restored: it was never accepted`);
  }
  const entry: AuditEntry = {
    transition: "restore",
    from: internals.state,
    to: "registered",
    revision,
  };
  internals.history = [...internals.history, entry];
  internals.state = "registered";
  internals.activeRevision = revision;
  internals.lastFailure = null;
  return { ok: true };
}

function makeMachine(internals: Internals): LifecycleMachine {
  return {
    get proposal() {
      return internals.proposal;
    },
    get state() {
      return internals.state;
    },
    get activeRevision() {
      return internals.activeRevision;
    },
    get acceptedRevisions() {
      return internals.acceptedRevisions;
    },
    get history() {
      return internals.history;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    get lastFailure() {
      return internals.lastFailure;
    },
    fire: (id) => fireTransition(internals, id),
    invoke: (request) => invokeCapability(internals, request),
    restore: (revision) => restoreRevision(internals, revision),
  };
}

export function createLifecycleMachine(proposal: CapabilityProposal): LifecycleMachine {
  const internals: Internals = {
    state: "proposed",
    proposal,
    activeRevision: null,
    acceptedRevisions: [],
    history: [],
    rejectionReason: null,
    lastFailure: null,
  };
  return makeMachine(internals);
}
