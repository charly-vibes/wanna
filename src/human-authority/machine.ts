// Purpose: human-authority state machine
// Responsibilities: the five model transitions (request, grant, deny, expire, invalidate) with their guards, plus the audited denial-retry path
// Rationale: authorization is re-checked at the effect boundary; every outcome is audited with provenance
import type {
  ApprovalRecord,
  ApprovalRequest,
  AuthorityGrant,
  AuthorityInput,
  AuditOutcome,
  AuditRecord,
  FireArg,
  HAState,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  approvalScopeExplicit,
  authorizationAtExecution,
  AUTHORITY_LAYER_VERSION,
  denialRequiresChange,
  materialChangeInvalidates,
} from "./invariants";

export const HA_TRANSITIONS: readonly { id: TransitionId; from: HAState; to: HAState }[] = [
  { id: "request_approval", from: "not_required", to: "pending" },
  { id: "grant_approval", from: "pending", to: "approved" },
  { id: "deny_approval", from: "pending", to: "denied" },
  { id: "expire_approval", from: "approved", to: "expired" },
  { id: "invalidate_approval", from: "approved", to: "invalidated" },
];

export interface AuthorityMachine {
  readonly state: HAState;
  readonly request: ApprovalRequest;
  readonly approval: ApprovalRecord | null;
  readonly denialReason: string | null;
  readonly audit: readonly AuditRecord[];
  fire(id: TransitionId, arg?: FireArg): TransitionResult;
  retryWith(next: ApprovalRequest): TransitionResult;
}

interface Internals {
  state: HAState;
  request: ApprovalRequest;
  approval: ApprovalRecord | null;
  denialReason: string | null;
  audit: AuditRecord[];
}

function buildApproval(request: ApprovalRequest, grant: AuthorityGrant): ApprovalRecord {
  return {
    requestId: request.requestId,
    principal: request.principal,
    action: request.action,
    resourceScope: request.resourceScope,
    riskClass: request.riskClass,
    reviewedRevision: request.reviewedRevision,
    source: grant.source,
    grantedBy: grant.grantedBy,
    expiry: request.expiry ?? null,
    invalidationConditions: [...(request.invalidationConditions ?? [])],
  };
}

function auditRecord(internals: Internals, outcome: AuditOutcome, reason: string | null): void {
  internals.audit.push({
    outcome,
    requestId: internals.request.requestId,
    principal: internals.request.principal,
    action: internals.request.action,
    reason,
    recordedBy: AUTHORITY_LAYER_VERSION,
  });
}

type AuthorityArgResult = { ok: true; authority: AuthorityInput } | { ok: false; reason: string };

function authorityArg(id: TransitionId, arg: FireArg | undefined): AuthorityArgResult {
  if (arg?.kind !== "authority") {
    return { ok: false, reason: `${id} requires an authority argument` };
  }
  return { ok: true, authority: arg.authority };
}

function guardForRequest(internals: Internals): TransitionResult {
  const check = approvalScopeExplicit(internals.request);
  return check.ok ? { ok: true } : { ok: false, reason: check.reason };
}

function guardForGrant(arg: FireArg | undefined, internals: Internals): TransitionResult {
  const a = authorityArg("grant_approval", arg);
  if (!a.ok) return a;
  return authorizationAtExecution(internals.request, a.authority);
}

function guardForDeny(arg: FireArg | undefined, internals: Internals): TransitionResult {
  const a = authorityArg("deny_approval", arg);
  if (!a.ok) return a;
  const check = authorizationAtExecution(internals.request, a.authority);
  if (check.ok) {
    return {
      ok: false,
      reason: "deny_approval requires authorization_at_execution not to hold — the pending effect is authorized",
    };
  }
  return { ok: true };
}

function guardForExpire(arg: FireArg | undefined, internals: Internals): TransitionResult {
  if (arg?.kind !== "now") return { ok: false, reason: "expire_approval requires a now argument" };
  const approval = internals.approval;
  if (!approval) return { ok: false, reason: "expire_approval requires a granted approval" };
  if (approval.expiry === null) {
    return {
      ok: false,
      reason: "approval_scope_explicit does not hold: approval carries no expiry to evaluate",
    };
  }
  if (arg.now < approval.expiry) {
    return {
      ok: false,
      reason: `approval is not yet expired (expiry ${approval.expiry}, now ${arg.now})`,
    };
  }
  return { ok: true };
}

function guardForInvalidate(arg: FireArg | undefined): TransitionResult {
  if (arg?.kind !== "change") {
    return { ok: false, reason: "invalidate_approval requires a material change argument" };
  }
  const check = materialChangeInvalidates(arg.change);
  return check.ok ? { ok: true } : { ok: false, reason: check.reason };
}

function guardHolds(internals: Internals, id: TransitionId, arg: FireArg | undefined): TransitionResult {
  if (id === "request_approval") return guardForRequest(internals);
  if (id === "grant_approval") return guardForGrant(arg, internals);
  if (id === "deny_approval") return guardForDeny(arg, internals);
  if (id === "expire_approval") return guardForExpire(arg, internals);
  return guardForInvalidate(arg);
}

function applyEffect(internals: Internals, id: TransitionId, arg: FireArg | undefined): void {
  if (id === "request_approval") {
    internals.state = "pending";
    return;
  }
  if (id === "grant_approval" && arg?.kind === "authority" && arg.authority.kind === "grant") {
    internals.state = "approved";
    internals.approval = buildApproval(internals.request, arg.authority);
    return;
  }
  if (id === "deny_approval" && arg?.kind === "authority") {
    internals.state = "denied";
    const check = authorizationAtExecution(internals.request, arg.authority);
    internals.denialReason = check.ok ? "authorization refused" : check.reason;
    return;
  }
  if (id === "expire_approval") {
    internals.state = "expired";
    return;
  }
  internals.state = "invalidated";
}

function outcomeFor(id: TransitionId): AuditOutcome {
  if (id === "request_approval") return "requested";
  if (id === "grant_approval") return "granted";
  if (id === "deny_approval") return "denied";
  if (id === "expire_approval") return "expired";
  return "invalidated";
}

function fireTransition(internals: Internals, id: TransitionId, arg: FireArg | undefined): TransitionResult {
  const row = HA_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    const reason = `transition ${id} cannot fire from state ${internals.state}`;
    auditRecord(internals, "refused", reason);
    return { ok: false, reason };
  }
  const guard = guardHolds(internals, id, arg);
  if (!guard.ok) {
    auditRecord(internals, "refused", guard.reason);
    return guard;
  }
  applyEffect(internals, id, arg);
  auditRecord(internals, outcomeFor(id), null);
  return { ok: true };
}

function retryWith(internals: Internals, next: ApprovalRequest): TransitionResult {
  if (internals.state !== "denied") {
    return {
      ok: false,
      reason: `denial_is_terminal_for_attempt does not hold: no denied attempt is pending (state is ${internals.state})`,
    };
  }
  const check = denialRequiresChange(internals.request, next);
  if (!check.ok) {
    auditRecord(internals, "refused", check.reason);
    return check;
  }
  internals.request = next;
  internals.state = "pending";
  auditRecord(internals, "requested", null);
  return { ok: true };
}

function makeMachine(internals: Internals): AuthorityMachine {
  return {
    get state() {
      return internals.state;
    },
    get request() {
      return internals.request;
    },
    get approval() {
      return internals.approval;
    },
    get denialReason() {
      return internals.denialReason;
    },
    get audit() {
      return internals.audit;
    },
    fire: (id, arg) => fireTransition(internals, id, arg),
    retryWith: (next) => retryWith(internals, next),
  };
}

export function createAuthorityMachine(request: ApprovalRequest): AuthorityMachine {
  const internals: Internals = {
    state: "not_required",
    request,
    approval: null,
    denialReason: null,
    audit: [],
  };
  return makeMachine(internals);
}