// Purpose: invariants for the interaction-primitives gate
// Responsibilities: layer separation, host neutrality, declarative contracts, evidence strength, typed failure paths, authority orthogonality, presentation grounding, continuity semantics
// Rationale: each invariant returns a precise failure reason so negative tests can assert exact strings — no masked violations
import type {
  AuthorityGrant,
  ContractDeclaration,
  InteractionSelection,
  PrimitiveRevision,
  ProvenanceRecord,
  SemanticLayer,
} from "./types";
import { EVIDENCE_CLASSES, SEMANTIC_LAYERS } from "./types";

export { EVIDENCE_CLASSES, SEMANTIC_LAYERS } from "./types";

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

const HOST_UI_TOKENS = ["dom", "react", "window", "document", "browser", "tui", "mcp"] as const;

export const GENERIC_AUTHORITY_SOURCES = [
  "confidence", "recommendation", "verification", "acknowledgement", "ui_render", "generic_click",
] as const;

export type GenericAuthoritySource = (typeof GENERIC_AUTHORITY_SOURCES)[number];

export const ALLOWED_AUTHORITY_SOURCES: readonly string[] = ["policy", "grant"];

function fail(reason: string): Check {
  return { ok: false, reason };
}

const OK: Check = { ok: true };

function scanHostVocabulary(fields: readonly unknown[]): string[] {
  const serialized = JSON.stringify(fields).toLowerCase();
  return HOST_UI_TOKENS.filter((token) => serialized.includes(token));
}

function missingLayer(layers: readonly SemanticLayer[]): Check {
  for (const layer of SEMANTIC_LAYERS) {
    if (!layers.includes(layer)) return fail(`semantic layer "${layer}" is not declared`);
  }
  return OK;
}

function duplicateLayer(revision: PrimitiveRevision): Check {
  for (const layer of SEMANTIC_LAYERS) {
    if (revision.layers.filter((l) => l.layer === layer).length > 1) {
      return fail(`semantic layer "${layer}" is declared more than once`);
    }
  }
  return OK;
}

function firstSharedPair(
  revision: PrimitiveRevision,
  field: "typeToken" | "updateRule",
  label: string,
): Check {
  for (let i = 0; i < revision.layers.length; i++) {
    for (let j = i + 1; j < revision.layers.length; j++) {
      // invariant: i and j are valid indices into revision.layers by loop construction
      const a = revision.layers[i]!;
      const b = revision.layers[j]!;
      if (a[field] === b[field]) {
        return fail(
          `semantic layer separation violated: layers "${a.layer}" and "${b.layer}" share ${label} "${a[field]}"`,
        );
      }
    }
  }
  return OK;
}

function declaredFields(revision: PrimitiveRevision): Check {
  for (const decl of revision.layers) {
    if (decl.typeToken.length === 0) {
      return fail(`semantic layer "${decl.layer}" declares no distinct type`);
    }
    if (decl.updateRule.length === 0) {
      return fail(`semantic layer "${decl.layer}" declares no update rule`);
    }
  }
  return OK;
}

export function semanticLayersSeparated(revision: PrimitiveRevision): Check {
  const declared = revision.layers.map((l) => l.layer);
  const missing = missingLayer(declared);
  if (!missing.ok) return missing;
  const duplicated = duplicateLayer(revision);
  if (!duplicated.ok) return duplicated;
  const fields = declaredFields(revision);
  if (!fields.ok) return fields;
  const token = firstSharedPair(revision, "typeToken", "type token");
  if (!token.ok) return token;
  return firstSharedPair(revision, "updateRule", "update rule");
}

export function hostNeutralCore(revision: PrimitiveRevision): Check {
  const leaks = scanHostVocabulary([revision.layers, revision.contracts, revision.provenance]);
  if (leaks.length > 0) return fail(`host UI vocabulary in core model: ${leaks.join(", ")}`);
  return OK;
}

function contractIssue(contract: ContractDeclaration): Check {
  if (contract.form !== "declarative-data") {
    return fail(`contract "${contract.contractId}" carries executable code and cannot enter the trusted core`);
  }
  if (contract.executableRef !== undefined) {
    return fail(
      `contract "${contract.contractId}" references executable code "${contract.executableRef}" — contracts are declarative data`,
    );
  }
  return OK;
}

export function contractsDeclarative(revision: PrimitiveRevision): Check {
  for (const contract of revision.contracts) {
    const issue = contractIssue(contract);
    if (!issue.ok) return issue;
  }
  return OK;
}

function provenanceIssue(record: ProvenanceRecord): Check {
  if (record.evidenceClass === undefined) {
    return fail(`provenance record "${record.claimId}" declares no evidence class and would become silently normative`);
  }
  if (!(EVIDENCE_CLASSES as readonly string[]).includes(record.evidenceClass)) {
    return fail(
      `provenance record "${record.claimId}" declares unknown evidence class "${record.evidenceClass}" — evidence strength is not explicit`,
    );
  }
  return OK;
}

export function evidenceStrengthExplicit(revision: PrimitiveRevision): Check {
  for (const record of revision.provenance) {
    const issue = provenanceIssue(record);
    if (!issue.ok) return issue;
  }
  return OK;
}

function pathIssue(path: PrimitiveRevision["failurePaths"][number]): Check {
  if (path.failureType.length === 0) {
    return fail(`failure path for "${path.operation}" declares no failure type`);
  }
  if (path.recoveryPreconditions.length === 0) {
    return fail(
      `failure path for "${path.operation}" declares recovery "${path.recovery}" without preconditions`,
    );
  }
  return OK;
}

export function failureAndRecoveryFirstClass(revision: PrimitiveRevision): Check {
  for (const path of revision.failurePaths) {
    if (!revision.mutatingOperations.includes(path.operation)) {
      return fail(`failure path references undeclared mutating operation "${path.operation}"`);
    }
  }
  for (const operation of revision.mutatingOperations) {
    if (!revision.failurePaths.some((p) => p.operation === operation)) {
      return fail(`mutating operation "${operation}" has no typed failure path`);
    }
  }
  for (const path of revision.failurePaths) {
    const issue = pathIssue(path);
    if (!issue.ok) return issue;
  }
  return OK;
}

export function authorityOrthogonal(revision: PrimitiveRevision): Check {
  for (const grant of revision.authorityGrants) {
    if (!(ALLOWED_AUTHORITY_SOURCES as readonly string[]).includes(grant.source)) {
      return fail(
        `authority grant "${grant.grantId}" derives from generic signal "${grant.source}" — only policy or explicit grants establish authority`,
      );
    }
  }
  return OK;
}

export function genericSignalCannotGrant(grant: AuthorityGrant): boolean {
  return (ALLOWED_AUTHORITY_SOURCES as readonly string[]).includes(grant.source);
}

function selectionIssue(selection: InteractionSelection): Check {
  if (selection.presentationRef === undefined) return OK;
  if (selection.needRef === undefined) {
    return fail(`interaction selection "${selection.selectionId}" chooses a presentation before a normalized need is grounded`);
  }
  if (selection.contributionRef === undefined) {
    return fail(`interaction selection "${selection.selectionId}" chooses a presentation before a semantic contribution is grounded`);
  }
  return OK;
}

export function contributionPrecedesPresentation(revision: PrimitiveRevision): Check {
  for (const selection of revision.selections) {
    const issue = selectionIssue(selection);
    if (!issue.ok) return issue;
  }
  return OK;
}

export function continuityNotPersistenceOnly(revision: PrimitiveRevision): Check {
  for (const record of revision.continuityRecords) {
    if (record.reorientation === undefined) {
      return fail(`continuity record "${record.checkpointId}" resumes from persisted state alone — reorientation semantics are missing`);
    }
    if (record.reconciliation === undefined) {
      return fail(`continuity record "${record.checkpointId}" resumes from persisted state alone — reconciliation semantics are missing`);
    }
  }
  return OK;
}