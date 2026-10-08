// Purpose: interaction-catalog state machine
// Responsibilities: the five transitions (validate, reject, correct, publish, retire) with their guards
// Rationale: the published catalog is immutable frozen data — the machine is the only mutation path, and it refuses everything but the declared transitions
import type {
  CatalogDefinition,
  CatalogState,
  CatalogTransitionId,
  TransitionPayload,
  TransitionResult,
} from "./types";
import {
  catalogSchemaValid,
  correctedCatalogReceived,
  publicationApproved,
  retirementExplicit,
} from "./invariants";
import { contentHash } from "./hash";

export { contentHash };

export interface TransitionRow {
  readonly id: CatalogTransitionId;
  readonly from: CatalogState;
  readonly to: CatalogState;
}

export const CATALOG_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_catalog", from: "draft", to: "validated" },
  { id: "reject_invalid_catalog", from: "draft", to: "invalid" },
  { id: "correct_catalog", from: "invalid", to: "draft" },
  { id: "publish_pinned_catalog", from: "validated", to: "published" },
  { id: "retire_catalog_version", from: "published", to: "retired" },
];

export interface CatalogMachine {
  readonly state: CatalogState;
  readonly definition: CatalogDefinition;
  readonly contentHash: string;
  readonly publishedHash: string | null;
  readonly rejectionReason: string | null;
  fire(id: CatalogTransitionId, payload?: TransitionPayload): TransitionResult;
}

interface Internals {
  state: CatalogState;
  definition: CatalogDefinition;
  rejectionReason: string | null;
  publishedHash: string | null;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function guardHolds(internals: Internals, id: CatalogTransitionId, payload?: TransitionPayload): TransitionResult {
  if (id === "validate_catalog") return catalogSchemaValid(internals.definition);
  if (id === "reject_invalid_catalog") {
    const check = catalogSchemaValid(internals.definition);
    return check.ok ? { ok: false, reason: "reject_invalid_catalog requires an invalid catalog" } : { ok: true };
  }
  if (id === "correct_catalog") return correctedCatalogReceived(payload?.nextDefinition);
  if (id === "publish_pinned_catalog") return publicationApproved(internals.definition, payload?.review);
  return retirementExplicit(payload?.retirement);
}

function applyEffect(internals: Internals, id: CatalogTransitionId, payload?: TransitionPayload): void {
  if (id === "validate_catalog") {
    internals.state = "validated";
    return;
  }
  if (id === "reject_invalid_catalog") {
    internals.state = "invalid";
    internals.rejectionReason = catalogSchemaValid(internals.definition).reason ?? "invalid catalog";
    return;
  }
  if (id === "correct_catalog") {
    internals.state = "draft";
    internals.definition = deepFreeze(payload?.nextDefinition ?? internals.definition);
    internals.rejectionReason = null;
    return;
  }
  if (id === "publish_pinned_catalog") {
    internals.state = "published";
    internals.publishedHash = contentHash(internals.definition);
    return;
  }
  internals.state = "retired";
}

function fireTransition(internals: Internals, id: CatalogTransitionId, payload?: TransitionPayload): TransitionResult {
  const row = CATALOG_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${String(id)}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardHolds(internals, id, payload);
  if (!guard.ok) return guard;
  applyEffect(internals, id, payload);
  return { ok: true };
}

function makeMachine(internals: Internals): CatalogMachine {
  return {
    get state() {
      return internals.state;
    },
    get definition() {
      return internals.definition;
    },
    get contentHash() {
      return contentHash(internals.definition);
    },
    get publishedHash() {
      return internals.publishedHash;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    fire: (id, payload) => fireTransition(internals, id, payload),
  };
}

export function createCatalogMachine(definition: CatalogDefinition): CatalogMachine {
  const internals: Internals = {
    state: "draft",
    definition: deepFreeze({ ...definition }),
    rejectionReason: null,
    publishedHash: null,
  };
  return makeMachine(internals);
}