// Purpose: active-surface stability and adaptation guards for the presentation-contract layer
// Responsibilities: active_interaction_stable and adaptation_reason_available checks
// Rationale: the active response surface is stable during input; material adaptive changes need a reason and, where safety permits, a revert option
import type { Adaptation, Check } from "./types";

export function isMaterialChange(change: Adaptation): boolean {
  return change.reorder !== undefined || change.replaceWith !== undefined;
}

export function activeInteractionStable(
  surface: readonly string[],
  change: Adaptation,
): Check {
  if (!isMaterialChange(change)) return { ok: true };
  if (change.safetyCritical === true || change.userAccepted === true) return { ok: true };
  return {
    ok: false,
    reason:
      "active response surface is stable during input; a material change requires a safety-critical transition or explicit user acceptance",
  };
}

export function adaptationReasonAvailable(change: Adaptation): Check {
  if (!isMaterialChange(change)) return { ok: true };
  if (change.reason === undefined || change.reason === "") {
    return { ok: false, reason: "material adaptive presentation change requires a user-comprehensible reason" };
  }
  return { ok: true };
}

export function revertPermitted(change: Adaptation): boolean {
  return isMaterialChange(change) && change.safetyCritical !== true;
}