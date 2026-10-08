// Purpose: vocabulary and record shapes for the interaction-contract layer
// Responsibilities: contract-schema version, pinned states and transitions, contract/response records, contribution and obligation types
// Rationale: a contract is serializable, non-executable data — every record is readonly and every vocabulary a closed union
export const CONTRACT_SCHEMA_VERSION = "interaction-contract-schema-1.0.0";

export type ContractState = "proposed" | "validated" | "invalid" | "retired";

export type ContractTransitionId =
  | "validate_contract"
  | "reject_contract"
  | "revise_invalid_contract"
  | "retire_contract";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export type Check = { ok: true } | { ok: false; reason: string };

export type ContributionRef =
  | { readonly primitive: string }
  | { readonly pattern: string; readonly patternVersion: string };

export interface ResponseSchema {
  readonly requiredFields: readonly string[];
  readonly outcomeVocabulary: readonly string[];
}

export interface AccessibilityObligations {
  readonly naming: string;
  readonly operation: string;
  readonly focusNavigation: string;
  readonly statusErrors: string;
  readonly timing: string | null;
}

export interface EscapePaths {
  readonly reject: string;
  readonly defer: string;
  readonly cancel: string;
  readonly dismiss: string;
  readonly timeout: string;
}

export interface InteractionContract {
  readonly interactionId: string;
  readonly schemaVersion: string;
  readonly interactionRevision: string;
  readonly taskId: string;
  readonly taskRevisionPrecondition: string;
  readonly kind: string;
  readonly contribution: ContributionRef;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly responseSchema: ResponseSchema;
  readonly accessibility: AccessibilityObligations;
  readonly escapePaths: EscapePaths;
}

export interface ContractResponse {
  readonly interactionId: string;
  readonly schemaVersion: string;
  readonly interactionRevision: string;
  readonly taskRevisionPrecondition: string;
  readonly eventId: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export type RetirementCommand =
  | { readonly retire: true; readonly reason: string }
  | { readonly supersededBy: string }
  | { readonly expiresAt: string };

export interface TransitionPayload {
  readonly nextContract?: InteractionContract;
  readonly command?: RetirementCommand;
}

export type MigrateResult =
  | { ok: true; version: string }
  | { ok: false; reason: string };

export interface ContractContentLimits {
  readonly maxLabelLength: number;
  readonly maxDescriptionLength: number;
  readonly maxOptions: number;
  readonly maxOptionValueLength: number;
  readonly maxNumericValue: number;
  readonly maxPayloadBytes: number;
}