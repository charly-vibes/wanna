// Purpose: the interaction-security gate state machine
// Responsibilities: the four transitions (accept, reject, resubmit, retire) with their guards, plus transition history recording
// Rationale: the gate treats agent payloads as untrusted data; validated interactions carry only trusted-resolved content
import { payloadPassesSecurityValidation } from "./checks";
import { buildRejectionDiagnostic } from "./diagnostics";
import type { RejectionDiagnostic } from "./diagnostics";
import { catalogComponentFor, escapeText } from "./policy";
import { LIFECYCLE_EVENTS } from "./types";
import type {
  AgentPayload,
  Check,
  ComponentMapping,
  LifecycleEvent,
  SecurityPolicy,
  SecurityState,
  TransitionId,
  TransitionRecord,
  TransitionResult,
  TransitionRow,
  TrustedOwnership,
  ValidatedInteraction,
} from "./types";

export type { TransitionRow } from "./types";

export const SECURITY_GATE_VERSION = "interaction-security-gate@1.0.0";

export const SECURITY_TRANSITIONS: readonly TransitionRow[] = [
  { id: "accept_validated_payload", from: "untrusted", to: "validated" },
  { id: "reject_untrusted_payload", from: "untrusted", to: "rejected" },
  { id: "resubmit_after_rejection", from: "rejected", to: "untrusted" },
  { id: "retire_after_use", from: "validated", to: "retired" },
];

export interface SecurityGate {
  readonly state: SecurityState;
  readonly payload: AgentPayload;
  readonly rejection: RejectionDiagnostic | null;
  readonly validated: ValidatedInteraction | null;
  readonly history: readonly TransitionRecord[];
  fire(id: TransitionId): TransitionResult;
  resubmit(next: AgentPayload): TransitionResult;
  retire(event?: LifecycleEvent): TransitionResult;
}

interface Internals {
  state: SecurityState;
  payload: AgentPayload;
  policy: SecurityPolicy;
  catalog: readonly ComponentMapping[];
  trusted: TrustedOwnership;
  rejection: RejectionDiagnostic | null;
  validated: ValidatedInteraction | null;
  history: TransitionRecord[];
}

function validate(internals: Internals): Check {
  return payloadPassesSecurityValidation(
    internals.payload,
    internals.policy,
    internals.catalog,
    internals.trusted,
  );
}

function record(
  internals: Internals,
  id: TransitionId,
  from: SecurityState,
  to: SecurityState,
): void {
  internals.history = [...internals.history, { id, from, to }];
}

function wrongState(id: TransitionId, state: SecurityState): TransitionResult {
  return { ok: false, reason: `transition ${id} cannot fire from state ${state}` };
}

function fireAccept(internals: Internals): TransitionResult {
  const check = validate(internals);
  if (!check.ok) {
    return {
      ok: false,
      reason: `guard payload_passes_security_validation does not hold: ${check.reason}`,
    };
  }
  internals.validated = buildValidated(internals.payload, internals.catalog);
  internals.state = "validated";
  record(internals, "accept_validated_payload", "untrusted", "validated");
  return { ok: true };
}

function fireReject(internals: Internals): TransitionResult {
  const check = validate(internals);
  if (check.ok) {
    return { ok: false, reason: "reject_untrusted_payload requires a failing payload" };
  }
  internals.rejection = buildRejectionDiagnostic(check, internals.policy);
  internals.state = "rejected";
  record(internals, "reject_untrusted_payload", "untrusted", "rejected");
  return { ok: true };
}

function buildValidated(
  payload: AgentPayload,
  catalog: readonly ComponentMapping[],
): ValidatedInteraction {
  const component = catalogComponentFor(payload.kind, catalog) ?? "";
  const validated: {
    kind: string;
    component: string;
    label: string;
    description?: string;
    options?: string[];
    url?: string;
    taskRevision: string;
    sessionId: string;
    interactionId: string;
    revision: number;
    validatedBy: string;
  } = {
    kind: payload.kind,
    component,
    label: escapeText(payload.label),
    taskRevision: payload.taskRevision,
    sessionId: payload.sessionId,
    interactionId: payload.interactionId,
    revision: payload.revision,
    validatedBy: SECURITY_GATE_VERSION,
  };
  if (payload.description !== undefined) validated.description = escapeText(payload.description);
  if (payload.options !== undefined) validated.options = payload.options.map(escapeText);
  if (payload.url !== undefined) validated.url = payload.url;
  return validated;
}

function payloadSignature(p: AgentPayload): string {
  return JSON.stringify([
    p.kind,
    p.label,
    p.description ?? null,
    p.options ?? null,
    p.url ?? null,
    p.component ?? null,
    p.data ?? null,
    p.taskRevision,
    p.sessionId,
    p.interactionId,
    p.revision,
    p.authorized ?? null,
    p.approvedBy ?? null,
    p.permissions ?? null,
  ]);
}

function fire(internals: Internals, id: TransitionId): TransitionResult {
  const row = SECURITY_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (id === "accept_validated_payload") {
    if (internals.state !== row.from) return wrongState(id, internals.state);
    return fireAccept(internals);
  }
  if (id === "reject_untrusted_payload") {
    if (internals.state !== row.from) return wrongState(id, internals.state);
    return fireReject(internals);
  }
  // resubmit and retire need their own arguments; fire() alone cannot carry them
  return { ok: false, reason: `transition ${id} requires resubmit()/retire()` };
}

function resubmit(internals: Internals, next: AgentPayload): TransitionResult {
  if (internals.state !== "rejected") {
    return wrongState("resubmit_after_rejection", internals.state);
  }
  if (payloadSignature(next) === payloadSignature(internals.payload)) {
    return {
      ok: false,
      reason: "guard new_proposal_received does not hold: identical payload resubmitted",
    };
  }
  internals.payload = next;
  internals.state = "untrusted";
  record(internals, "resubmit_after_rejection", "rejected", "untrusted");
  return { ok: true };
}

function retire(internals: Internals, event?: LifecycleEvent): TransitionResult {
  if (internals.state !== "validated") {
    return wrongState("retire_after_use", internals.state);
  }
  if (event === undefined || !(LIFECYCLE_EVENTS as readonly string[]).includes(event)) {
    return {
      ok: false,
      reason: "guard interaction_consumed_or_expired does not hold: no lifecycle event",
    };
  }
  internals.state = "retired";
  record(internals, "retire_after_use", "validated", "retired");
  return { ok: true };
}

function makeGate(internals: Internals): SecurityGate {
  return {
    get state() {
      return internals.state;
    },
    get payload() {
      return internals.payload;
    },
    get rejection() {
      return internals.rejection;
    },
    get validated() {
      return internals.validated;
    },
    get history() {
      return internals.history;
    },
    fire: (id) => fire(internals, id),
    resubmit: (next) => resubmit(internals, next),
    retire: (event) => retire(internals, event),
  };
}

export function createSecurityGate(
  payload: AgentPayload,
  policy: SecurityPolicy,
  catalog: readonly ComponentMapping[],
  trusted: TrustedOwnership,
): SecurityGate {
  const internals: Internals = {
    state: "untrusted",
    payload,
    policy,
    catalog,
    trusted,
    rejection: null,
    validated: null,
    history: [],
  };
  return makeGate(internals);
}
