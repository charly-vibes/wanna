// Purpose: pinned registries and explicit migrations for the interaction-contract layer
// Responsibilities: kind contract schemas pinned to the host-neutral catalog, content limits, supported schema versions, registered migrations
// Rationale: every registry is a closed allowlist — kinds come from the pinned host-neutral catalog, versions migrate only by explicit registered migration
import type { ContractContentLimits, MigrateResult } from "./types";
import { CONTRACT_SCHEMA_VERSION } from "./types";
import { INTERACTION_KINDS } from "../interaction-catalog/types";
import type { InteractionKind } from "../interaction-catalog/types";
import { COMPOUND_ACTIVITIES, PRIMITIVE_KINDS } from "../contribution-primitives/types";

export { COMPOUND_ACTIVITIES, PRIMITIVE_KINDS };

export interface KindContractSchema {
  readonly requiredPayloadFields: readonly string[];
  readonly responseFields: readonly string[];
}

export const KIND_CONTRACT_SCHEMAS: Record<InteractionKind, KindContractSchema> = {
  clarify: { requiredPayloadFields: ["question"], responseFields: ["answer"] },
  choose: { requiredPayloadFields: ["question", "options"], responseFields: ["selected"] },
  rank: { requiredPayloadFields: ["question", "options"], responseFields: ["order"] },
  configure: { requiredPayloadFields: ["fields"], responseFields: ["values"] },
  review: { requiredPayloadFields: ["artifact", "criteria"], responseFields: ["verdict"] },
  diagnose: { requiredPayloadFields: ["symptom"], responseFields: ["findings"] },
  verify: { requiredPayloadFields: ["claim"], responseFields: ["confirmed"] },
  authorize: { requiredPayloadFields: ["action", "scope"], responseFields: ["decision"] },
};

export const PINNED_CONTRACT_KINDS: readonly string[] = [...INTERACTION_KINDS];

export const CONTRACT_CONTENT_LIMITS: ContractContentLimits = {
  maxLabelLength: 120,
  maxDescriptionLength: 1000,
  maxOptions: 20,
  maxOptionValueLength: 200,
  maxNumericValue: 1000000,
  maxPayloadBytes: 8192,
};

export const SUPPORTED_CONTRACT_SCHEMA_VERSIONS: readonly string[] = [CONTRACT_SCHEMA_VERSION];

export const REGISTERED_CONTRACT_MIGRATIONS: Record<string, { from: string; to: string }> = {
  "migrate-contract-schema-v1-to-v2": {
    from: CONTRACT_SCHEMA_VERSION,
    to: "interaction-contract-schema-2.0.0",
  },
};

export function migrateInteractionContract(version: string, migrationName: string): MigrateResult {
  const migration = REGISTERED_CONTRACT_MIGRATIONS[migrationName];
  if (!migration) {
    return {
      ok: false,
      reason: `contract_version_migration_explicit does not hold: no registered migration "${migrationName}"`,
    };
  }
  if (version !== migration.from) {
    return {
      ok: false,
      reason: `registered migration "${migrationName}" applies to contract-schema version "${migration.from}", not "${version}"`,
    };
  }
  return { ok: true, version: migration.to };
}