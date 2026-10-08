// Purpose: public surface of the interaction-catalog layer
// Responsibilities: re-export the machine, types, invariants, and trusted registries under one entry point
// Rationale: callers import from the capability, never from internals
export { createCatalogMachine, CATALOG_TRANSITIONS, contentHash } from "./machine";
export type { CatalogMachine, TransitionRow } from "./machine";
export {
  AGENT_PROPOSAL_REASON,
  applyAgentProposal,
  catalogSchemaValid,
  correctedCatalogReceived,
  kindSetPinned,
  publicationApproved,
  resolveKindForNeed,
  retirementExplicit,
} from "./invariants";
export {
  CATALOG_KIND_SETS,
  CATALOG_VERSION_V1,
  REGISTERED_MIGRATIONS,
  RUNTIME_VALIDATORS,
  TRUSTED_RENDERERS,
  authorizeDecision,
  createAuthorizeContract,
  migrateContract,
  resolveOptionReferences,
  resolveRenderer,
  validateResponse,
} from "./registries";
export type { Check } from "./types";
export type {
  AgentCatalogProposal,
  AuthorizeContract,
  AuthorizeContractInput,
  AuthorizeDecisionInput,
  CatalogDefinition,
  CatalogState,
  CatalogTransitionId,
  CompatibilityReview,
  InteractionKind,
  KindBounds,
  KindDefinition,
  KindMapping,
  KindResolution,
  MigrateResult,
  OptionSpec,
  ResponseRecord,
  RetirementAction,
  TransitionPayload,
  TransitionResult,
} from "./types";
export { INTERACTION_KINDS } from "./types";