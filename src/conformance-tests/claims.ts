// Purpose: release-gate checks for quality claims, usability distinctness, and empirical outcomes
// Responsibilities: claim-evidence matching, baseline measurements, acceptance statuses, empirical verdicts
// Rationale: no release claim without recorded gate evidence ([[spec.no_claim_without_evidence]]); machine pass never claims usability
export type QualityClaim = "lint-clean" | "model-checked" | "verified" | "portable" | "secure";

export interface GateResult {
  readonly gate: QualityClaim;
  readonly result: "pass" | "fail";
}

export function blockedClaims(
  claims: readonly string[],
  results: readonly GateResult[],
): string[] {
  const passing = new Set<string>(results.filter((r) => r.result === "pass").map((r) => r.gate));
  return claims
    .filter((claim) => !passing.has(claim))
    .map((claim) => `claim ${claim} has no passing ${claim} gate result`);
}

export type UsageClaimKind = "performance" | "usability";

export interface UsageClaim {
  readonly kind: UsageClaimKind;
  readonly scenarioSet: string;
}

export interface MeasurementSet {
  readonly scenarioSet: string;
  readonly baseline: boolean;
  readonly advisorGuided: boolean;
}

export function baselineGaps(
  claims: readonly UsageClaim[],
  measurements: readonly MeasurementSet[],
): string[] {
  const supports = (claim: UsageClaim): boolean =>
    measurements.some(
      (m) => m.scenarioSet === claim.scenarioSet && m.baseline && m.advisorGuided,
    );
  return claims
    .filter((claim) => !supports(claim))
    .map(
      (claim) =>
        `${claim.kind} claim on scenario set ${claim.scenarioSet} requires baseline and advisor-guided measurements`,
    );
}

export type UsabilityStatus = "unverified" | "planned" | "passed";

export interface UsabilityEvidence {
  readonly studyKind: string;
  readonly participants: number;
}

export function usabilityAfterMachinePass(current: UsabilityStatus): UsabilityStatus {
  return current;
}

export function recordUsabilityStatus(
  current: UsabilityStatus,
  evidence: UsabilityEvidence | null,
): UsabilityStatus {
  if (evidence === null) return current;
  if (evidence.studyKind !== "representative-user-study") return current;
  if (evidence.participants <= 0) return current;
  return "passed";
}

export type AcceptanceStatus = "planned" | "unverified" | "verified";

export interface AcceptanceInput {
  readonly implemented: boolean;
  readonly evidenceRecorded: boolean;
}

export function acceptanceStatus(input: AcceptanceInput): AcceptanceStatus {
  if (!input.implemented) return "planned";
  return input.evidenceRecorded ? "verified" : "unverified";
}

export const EMPIRICAL_OUTCOMES = [
  "learnability", "comprehension", "perceived-control", "trust-calibration",
] as const;

export interface EmpiricalClaim {
  readonly outcome: string;
  readonly evidenceKind?: string;
  readonly machineProxy?: string;
}

export interface EmpiricalVerdict {
  readonly machineVerifiable: boolean;
  readonly reason: string;
}

export function empiricalClaimVerdict(claim: EmpiricalClaim): EmpiricalVerdict {
  const isHuman = (EMPIRICAL_OUTCOMES as readonly string[]).includes(claim.outcome);
  if (!isHuman) {
    return { machineVerifiable: true, reason: `outcome ${claim.outcome} is not an empirical human outcome` };
  }
  if (claim.evidenceKind === "representative-user-study") {
    return { machineVerifiable: true, reason: `${claim.outcome} verified by representative user evidence` };
  }
  const proxy = claim.machineProxy?.trim() ?? "";
  if (proxy.length > 0) {
    return {
      machineVerifiable: true,
      reason: `${claim.outcome} checkable through explicitly named proxy ${proxy}`,
    };
  }
  return {
    machineVerifiable: false,
    reason: `${claim.outcome} remains an empirical property requiring representative user evidence`,
  };
}
