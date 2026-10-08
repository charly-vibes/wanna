// Purpose: test fixtures for the host adapter layer
// Responsibilities: build canonical contracts/responses (shared vocabulary), host capabilities, and core validators
// Rationale: single source of shared adapter vocabulary for transitions and properties tests;
//   contracts come from the interaction-contract layer — adapters consume the same shared contract
import { validContract, responseFor } from "../interaction-contract/fixtures";
import type { ContractResponse, InteractionContract } from "../../src/interaction-contract/types";
import type { CoreValidator, HostCapability } from "../../src/host-adapters/types";

export const TUI = "pi-tui";
export const WEB = "browser-web";

export const DEFAULT_SUPPORTED = ["clarify", "choose", "authorize"] as const;

export function capability(overrides: Partial<HostCapability> = {}): HostCapability {
  return {
    host: TUI,
    supportedKinds: [...DEFAULT_SUPPORTED],
    fallbacks: { rank: "choose" },
    inputModes: ["keyboard", "pointer"],
    ...overrides,
  };
}

export function webCapability(overrides: Partial<HostCapability> = {}): HostCapability {
  return capability({ host: WEB, ...overrides });
}

export function keyboardOnlyCapability(overrides: Partial<HostCapability> = {}): HostCapability {
  return capability({ inputModes: ["keyboard"], ...overrides });
}

export function rejectingCore(reason: string): CoreValidator {
  return () => ({ ok: false, reason });
}

export function acceptingCore(receipt = "commit:forced"): CoreValidator {
  return () => ({ ok: true, commitReceipt: receipt });
}

export { validContract, responseFor };
export type { ContractResponse, InteractionContract };