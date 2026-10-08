// Purpose: public surface of the host adapter layer
// Responsibilities: re-export the machine, transitions, invariants, presentation, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { ADAPTER_TRANSITIONS, createHostAdapter } from "./machine";
export type { HostAdapter } from "./machine";
export {
  checkCapability,
  coreRevalidatesResponse,
  incomingContractValid,
  keyboardOperable,
} from "./invariants";
export { createPresentationHandle, controlsFor } from "./presentation";
export type { ControlSpec, PresentationHandle } from "./presentation";
export { INTERACTION_KINDS } from "../interaction-catalog/types";
export type {
  AdapterHandler,
  AdapterInternals,
  AdapterPayload,
  AdapterState,
  AdapterTransitionId,
  CapabilityResult,
  Check,
  CoreValidation,
  CoreValidator,
  HostCapability,
  HostEvent,
  PresentResult,
  TransitionResult,
  TransitionRow,
} from "./types";