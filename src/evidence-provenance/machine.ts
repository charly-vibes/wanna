// Purpose: evidence-provenance state machine
// Responsibilities: the four transitions (validate, commit, supersede, restrict) with their guards and audit-log effect
// Rationale: the machine mirrors [[spec]] ## Model row for row; every applied transition appends to the audit log
import type {
  AppliedTransition,
  AuditEntry,
  EvidenceProposal,
  EvidenceState,
  FireArg,
  TransitionId,
} from "./types";
import { EVIDENCE_TRANSITIONS } from "./types";
import {
  auditRecordsAppendOnly,
  evidenceHasIdentity,
  sensitiveDataMinimized,
  transformationsLinked,
} from "./invariants";

export interface EvidenceLayer {
  readonly state: EvidenceState;
  readonly applied: readonly AppliedTransition[];
  readonly auditLog: readonly AuditEntry[];
  fire(id: TransitionId, arg?: FireArg): TransitionResult;
}

interface Internals {
  state: EvidenceState;
  proposal: EvidenceProposal;
  auditLog: AuditEntry[];
  applied: AppliedTransition[];
}

type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

type Guard = (internals: Internals, arg: FireArg | undefined) => TransitionResult;

function guardValidate(internals: Internals): TransitionResult {
  return evidenceHasIdentity(internals.proposal);
}

function guardCommit(internals: Internals): TransitionResult {
  return transformationsLinked(internals.proposal);
}

const IN_PLACE_EDIT_REASON =
  "supersede_evidence guard audit_records_append_only does not hold: corrections are new linked records with their own identity, not edits of committed records";

function guardSupersede(internals: Internals, arg: FireArg | undefined): TransitionResult {
  if (arg?.kind !== "correction")
    return { ok: false, reason: "supersede_evidence requires a correction argument naming the new record" };
  const currentId = internals.proposal.id ?? "";
  if (arg.correctionId === currentId || arg.correctionId.length === 0)
    return { ok: false, reason: IN_PLACE_EDIT_REASON };
  const entry: AuditEntry = {
    seq: internals.auditLog.length,
    transition: "supersede_evidence",
    recordId: arg.correctionId,
    replaces: currentId,
  };
  return auditRecordsAppendOnly(internals.auditLog, entry);
}

function guardRestrict(internals: Internals, arg: FireArg | undefined): TransitionResult {
  if (arg?.kind !== "policy")
    return { ok: false, reason: "restrict_sensitive_evidence requires a configured redaction/access policy" };
  return sensitiveDataMinimized(internals.proposal, arg.policy);
}

const GUARDS: Readonly<Record<TransitionId, Guard>> = {
  validate_evidence: guardValidate,
  commit_evidence: guardCommit,
  supersede_evidence: guardSupersede,
  restrict_sensitive_evidence: guardRestrict,
};

function auditEntryFor(internals: Internals, id: TransitionId, arg: FireArg | undefined): AuditEntry {
  const base: AuditEntry = {
    seq: internals.auditLog.length,
    transition: id,
    recordId: internals.proposal.id ?? "",
  };
  if (id === "supersede_evidence" && arg?.kind === "correction") {
    return { ...base, recordId: arg.correctionId, replaces: internals.proposal.id ?? "" };
  }
  return base;
}

function applyEffect(internals: Internals, id: TransitionId, arg: FireArg | undefined): void {
  const row = EVIDENCE_TRANSITIONS.find((r) => r.id === id)!;
  internals.state = row.to;
  internals.applied = [...internals.applied, { id, from: row.from, to: row.to }];
  internals.auditLog = [...internals.auditLog, auditEntryFor(internals, id, arg)];
}

function fireTransition(internals: Internals, id: TransitionId, arg: FireArg | undefined): TransitionResult {
  const row = EVIDENCE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from)
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  const guard = GUARDS[id](internals, arg);
  if (!guard.ok) return guard;
  applyEffect(internals, id, arg);
  return { ok: true };
}

function makeMachine(internals: Internals): EvidenceLayer {
  return {
    get state() {
      return internals.state;
    },
    get applied() {
      return internals.applied;
    },
    get auditLog() {
      return internals.auditLog;
    },
    fire: (id, arg) => fireTransition(internals, id, arg),
  };
}

export function createEvidenceLayer(proposal: EvidenceProposal): EvidenceLayer {
  const internals: Internals = {
    state: "proposed",
    proposal,
    auditLog: [],
    applied: [],
  };
  return makeMachine(internals);
}
