// Purpose: declared-port open behavior for the composition shell (wanna-0te)
// Responsibilities: typed construction rejection before any port contact, port-load mapping to ready/rejected/unavailable/recovery_required, canonical stored-revision refusal without mutation
// Rationale: spec scenarios port-is-constructor-required, commits-only-via-port, port-failure-semantics-tested (open boundary), review-mapping-checked and continuity_restored (incompatible stored version); commit/submit semantics are owned by wanna-8k6
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  AggregateSnapshot,
  OpenReviewSessionInput,
  OpenReviewSessionOutcome,
  PortLoadOutcome,
  ReviewPersistencePort,
  SessionTaskKey,
} from "./types";
import {
  createReviewSessionShell,
  emptyShellState,
  shellStateFromSnapshot,
} from "./session";
import type { ShellState } from "./session";
import type { ShellPins } from "./evaluate";

type ReasonCheck = () => string | null;

type FailedLoad = Extract<
  PortLoadOutcome,
  { kind: "unavailable" | "recovery_required" }
>;

/** Return the first non-null reason any check produces. */
function firstReason(checks: readonly ReasonCheck[]): string | null {
  for (const check of checks) {
    const reason = check();
    if (reason !== null) return reason;
  }
  return null;
}

/** A named field must be a non-empty string. */
function missingString(value: unknown, label: string): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return `${label} must be a non-empty string`;
  }
  return null;
}

function portRejection(port: unknown): string | null {
  if (typeof port !== "object" || port === null) {
    return "port must be a declared ReviewPersistencePort object";
  }
  return null;
}

function portMethodsRejection(port: unknown): string | null {
  const candidate = port as Partial<ReviewPersistencePort> | null;
  const methods = [
    candidate?.load,
    candidate?.compareAndCommit,
    candidate?.reconcile,
  ];
  if (methods.some((method) => typeof method !== "function")) {
    return "port must declare load, compareAndCommit and reconcile functions";
  }
  return null;
}

function scopeRejection(port: unknown): string | null {
  const scope = (port as Partial<ReviewPersistencePort> | null)
    ?.deduplicationScope;
  if (!(scope instanceof Set) || scope.size === 0) {
    return "port must declare a non-empty deduplication scope";
  }
  return null;
}

function keyRejection(key: SessionTaskKey | undefined): string | null {
  return firstReason([
    () => missingString(key?.sessionId, "key.sessionId"),
    () => missingString(key?.taskId, "key.taskId"),
  ]);
}

/**
 * Construction-time input validation
 * ([[composition.shell.port_required_declared]]): every rejection reason is
 * checked before the port is contacted, so a rejected construction can never
 * reach storage.
 */
function constructionRejection(input: OpenReviewSessionInput): string | null {
  return firstReason([
    () => portRejection(input.port),
    () => portMethodsRejection(input.port),
    () => scopeRejection(input.port),
    () => keyRejection(input.key as SessionTaskKey | undefined),
    () =>
      missingString(
        (input.policy as ReviewPolicyInput | undefined)?.policyVersion,
        "policy.policyVersion",
      ),
    () =>
      missingString(
        (input.catalog as ReviewCatalogInput | undefined)?.catalogVersion,
        "catalog.catalogVersion",
      ),
  ]);
}

interface ReviewPolicyInput {
  readonly policyVersion?: unknown;
}

interface ReviewCatalogInput {
  readonly catalogVersion?: unknown;
}

/** A stored revision must be a safe integer at or above `minimum`. */
function isCanonicalRevision(value: unknown, minimum: number): boolean {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
  );
}

function revisionRejection(
  value: unknown,
  label: string,
  minimum: number,
): string | null {
  if (!isCanonicalRevision(value, minimum)) {
    return `stored ${label} is not a canonical revision (expected safe integer >= ${minimum})`;
  }
  return null;
}

function listRejection(value: unknown, label: string): string | null {
  if (!Array.isArray(value)) return `stored ${label} is not a list`;
  return null;
}

/**
 * Stored-aggregate canonicality ([[composition.shell.review_mapping_checked]]):
 * a noncanonical or unsafe stored revision is an unsupported boundary
 * representation — refused without touching storage.
 */
function storedStateRejection(snapshot: AggregateSnapshot): string | null {
  return firstReason([
    () => revisionRejection(snapshot.aggregateVersion, "aggregateVersion", 1),
    () => revisionRejection(snapshot.taskRevision, "taskRevision", 0),
    () => listRejection(snapshot.replay, "replay"),
    () => listRejection(snapshot.receipts, "receipts"),
  ]);
}

/** Non-empty open reason: prefer the port's, synthesize when it omits one. */
function portReason(kind: FailedLoad["kind"], reason: string | undefined): string {
  if (typeof reason === "string" && reason.length > 0) return reason;
  return `port load reported ${kind} without a reason`;
}

function readyOutcome(state: ShellState, pins: ShellPins): OpenReviewSessionOutcome {
  return { kind: "ready", shell: createReviewSessionShell(state, pins) };
}

function loadedOutcome(snapshot: AggregateSnapshot, pins: ShellPins): OpenReviewSessionOutcome {
  const rejection = storedStateRejection(snapshot);
  if (rejection !== null) return { kind: "recovery_required", reason: rejection };
  return readyOutcome(shellStateFromSnapshot(snapshot), pins);
}

function failedLoadOutcome(outcome: FailedLoad): OpenReviewSessionOutcome {
  if (outcome.kind === "unavailable") {
    return { kind: "unavailable", reason: portReason("unavailable", outcome.reason) };
  }
  return { kind: "recovery_required", reason: portReason("recovery_required", outcome.reason) };
}

function mapLoadOutcome(outcome: PortLoadOutcome, pins: ShellPins): OpenReviewSessionOutcome {
  if (outcome.kind === "loaded") return loadedOutcome(outcome.snapshot, pins);
  if (outcome.kind === "not_found") return readyOutcome(emptyShellState(), pins);
  return failedLoadOutcome(outcome);
}

/** A thrown port-load failure obeys the declared typed `unavailable` outcome. */
async function loadThroughPort(
  port: ReviewPersistencePort,
  key: SessionTaskKey,
): Promise<PortLoadOutcome> {
  try {
    return await port.load(key);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: "unavailable", reason: `port load threw: ${detail}` };
  }
}

/**
 * Opens a review session from a trusted key, immutable policy/catalog inputs
 * and an explicitly declared persistence port
 * ([[composition.shell.port_required_declared]]). Construction inputs are
 * validated before any port contact; `not_found` yields an unpersisted ready
 * shell whose aggregate is created only through the port's conditional commit.
 */
export async function openReviewSession(
  input: OpenReviewSessionInput,
): Promise<OpenReviewSessionOutcome> {
  const rejection = constructionRejection(input);
  if (rejection !== null) return { kind: "rejected", reason: rejection };
  const pins: ShellPins = {
    key: input.key,
    policy: input.policy,
    catalog: input.catalog,
  };
  const loaded = await loadThroughPort(input.port, input.key);
  return mapLoadOutcome(loaded, pins);
}