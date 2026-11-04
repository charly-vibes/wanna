// Purpose: invariants for the human-authority layer
// Responsibilities: scope explicitness, execution-time authorization, material-change invalidation, denial terminality
// Rationale: each invariant returns a precise failure reason so negative tests can assert the exact string
import type {
  ApprovalRequest,
  AuthorityInput,
  AuthoritySource,
  MaterialChange,
  RiskClass,
} from "./types";

import { AUTHORITY_SOURCES, RISK_CLASSES, VERIFICATION_BASES } from "./types";

export { AUTHORITY_SOURCES, RISK_CLASSES, REQUESTER_KINDS, VERIFICATION_BASES } from "./types";

export const AUTHORITY_LAYER_VERSION = "human-authority@1.0.0";

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export const MATERIAL_CHANGE_FIELDS: readonly string[] = ["action", "target", "evidence", "revision"];

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}

const REQUIRED_SCOPES: readonly [keyof ApprovalRequest, string][] = [
  ["requestId", "request identity"],
  ["principal", "principal"],
  ["action", "action"],
  ["resourceScope", "resource scope"],
];

export function approvalScopeExplicit(request: ApprovalRequest): Check {
  for (const [field, label] of REQUIRED_SCOPES) {
    if (!isNonEmpty(request[field] as string)) {
      return { ok: false, reason: `approval_scope_explicit does not hold: missing ${label}` };
    }
  }
  if (!(RISK_CLASSES as readonly string[]).includes(request.riskClass)) {
    return {
      ok: false,
      reason: `approval_scope_explicit does not hold: unsupported risk class: ${String(request.riskClass)}`,
    };
  }
  if (!isNonEmpty(request.reviewedRevision)) {
    return { ok: false, reason: "approval_scope_explicit does not hold: missing reviewed revision" };
  }
  const hasExpiry = typeof request.expiry === "number";
  const hasConditions = (request.invalidationConditions?.length ?? 0) > 0;
  if (!hasExpiry && !hasConditions) {
    return {
      ok: false,
      reason: "approval_scope_explicit does not hold: approval has neither expiry nor invalidation conditions",
    };
  }
  return { ok: true };
}

function grantCoversRequest(request: ApprovalRequest, authority: AuthorityInput): Check {
  const grant = authority as Extract<AuthorityInput, { kind: "grant" }>;
  const mismatches: readonly [boolean, string][] = [
    [grant.principal !== request.principal, `current identity ${grant.principal} does not match the approval principal ${request.principal}`],
    [grant.action !== request.action, `authority does not cover the requested action: ${grant.action} vs ${request.action}`],
    [grant.resource !== request.resourceScope, `authority scope ${grant.resource} does not match the approval resource scope ${request.resourceScope}`],
    [grant.revision !== request.reviewedRevision, `authority revision ${grant.revision} does not match the reviewed revision ${request.reviewedRevision}`],
    [grant.policyVersion !== request.policyVersion, `authority policy version ${grant.policyVersion} does not match the request policy version ${request.policyVersion}`],
  ];
  for (const [mismatch, reason] of mismatches) {
    if (mismatch) return { ok: false, reason };
  }
  return { ok: true };
}

function boundedGrantInBudget(authority: AuthorityInput): Check {
  const grant = authority as Extract<AuthorityInput, { kind: "grant" }>;
  if (grant.maxUses === undefined) return { ok: true };
  if (grant.usesRemaining === undefined) {
    return { ok: false, reason: "bounded automation grant is missing its remaining-use count" };
  }
  if (grant.usesRemaining <= 0) {
    return {
      ok: false,
      reason: `bounded automation grant is exhausted (0 of ${grant.maxUses} uses remaining)`,
    };
  }
  return { ok: true };
}

export function authorizationAtExecution(request: ApprovalRequest, authority: AuthorityInput): Check {
  if (authority.kind === "verification") {
    return {
      ok: false,
      reason: `verification_not_authority: ${authority.basis} alone does not satisfy an authorization requirement without a separate applicable authority grant`,
    };
  }
  if (!(AUTHORITY_SOURCES as readonly string[]).includes(authority.source)) {
    return { ok: false, reason: `unknown authority source: ${String(authority.source)}` };
  }
  if (authority.grantedBy === "model") {
    return {
      ok: false,
      reason:
        "model_cannot_self_approve: a model-generated proposal or confidence score cannot satisfy a required human or external authority requirement",
    };
  }
  const covers = grantCoversRequest(request, authority);
  if (!covers.ok) return covers;
  return boundedGrantInBudget(authority);
}

export function materialChangeInvalidates(change: MaterialChange): Check {
  if (!(MATERIAL_CHANGE_FIELDS as readonly string[]).includes(change.field)) {
    return {
      ok: false,
      reason: `approval_invalidated_on_material_change does not hold: ${change.field} is not a material change field`,
    };
  }
  if (change.permitsReuse) {
    return {
      ok: false,
      reason:
        "approval_invalidated_on_material_change does not hold: policy explicitly permits reuse of the prior approval",
    };
  }
  return { ok: true };
}

export function denialRequiresChange(
  previous: ApprovalRequest,
  next: ApprovalRequest,
): Check {
  const changed =
    previous.action !== next.action ||
    previous.resourceScope !== next.resourceScope ||
    previous.reviewedRevision !== next.reviewedRevision ||
    previous.evidenceDigest !== next.evidenceDigest;
  if (changed) return { ok: true };
  return {
    ok: false,
    reason:
      "denial_is_terminal_for_attempt does not hold: the retried request is unchanged under policy — a new approval or a changed request is required",
  };
}

export function isAuthoritySource(value: string): value is AuthoritySource {
  return (AUTHORITY_SOURCES as readonly string[]).includes(value);
}

export function isRiskClass(value: string): value is RiskClass {
  return (RISK_CLASSES as readonly string[]).includes(value);
}

export function isVerificationBasis(value: string): boolean {
  return (VERIFICATION_BASES as readonly string[]).includes(value);
}