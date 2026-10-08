// Purpose: reproducible failure reports for conformance scenarios
// Responsibilities: build and validate failure reports carrying stable identity and pinned versions
// Rationale: a failing scenario must emit everything needed to reproduce it ([[spec.test_outcomes_reproducible]])
import type { PinnedVersions } from "./types";

export interface FailureReportInput {
  readonly testId: string;
  readonly fixtureId: string;
  readonly versions: PinnedVersions;
  readonly expected: string;
  readonly actual: string;
  readonly minimizedReproduction?: string;
}

export interface FailureReport {
  readonly testId: string;
  readonly fixtureId: string;
  readonly schemaVersion: string;
  readonly catalogVersion: string;
  readonly policyVersion: string;
  readonly expected: string;
  readonly actual: string;
  readonly minimizedReproduction: string | null;
}

export function buildFailureReport(input: FailureReportInput): FailureReport {
  return {
    testId: input.testId,
    fixtureId: input.fixtureId,
    schemaVersion: input.versions.schemaVersion,
    catalogVersion: input.versions.catalogVersion,
    policyVersion: input.versions.policyVersion,
    expected: input.expected,
    actual: input.actual,
    minimizedReproduction: input.minimizedReproduction ?? null,
  };
}

const REQUIRED_FIELDS = [
  "testId", "fixtureId", "schemaVersion", "catalogVersion",
  "policyVersion", "expected", "actual",
] as const;

export function failureReportIssues(report: FailureReport): string[] {
  return REQUIRED_FIELDS.filter((field) => report[field].length === 0).map(
    (field) => `missing ${field}`,
  );
}
