// Purpose: documentation-contract test for the reuse comparison report (wanna-zcq)
// Responsibilities: fail on absent/incomplete reuse evidence — the report must define the comparison protocol, separate initial and marginal effort, disclose author familiarity and excluded costs, count consumer-owned coordination (matching the actual example sources on disk), record core changes and carry an explicit proceed/revise/narrow/defer decision
// Rationale: [[review.workbench.reuse_comparison_complete]] — test counts alone are not value evidence; this test makes report drift from the measured sources a red contract
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const reportPath = join(repoRoot, "docs", "reuse-comparison.md");

/** Total line count of every .ts source in an example directory (wc -l semantics). */
function sourceLines(dir: string): number {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => {
      const content = readFileSync(join(dir, n), "utf8");
      const lines = content.split("\n");
      return lines.at(-1) === "" ? lines.length - 1 : lines.length;
    })
    .reduce((a, b) => a + b, 0);
}

describe("reuse comparison report contract", () => {
  const report = readFileSync(reportPath, "utf8");

  it("defines the comparison protocol before the implementations", () => {
    for (const required of ["## Comparison protocol", "current/stale/restart"]) {
      expect(report).toContain(required);
    }
    expect(report).toMatch(/identical acceptance scenarios/i);
  });

  it("separates initial and marginal effort and discloses familiarity", () => {
    for (const required of [
      "## Initial effort",
      "## Marginal second-consumer effort",
      "## Author familiarity",
      "## Excluded costs",
    ]) {
      expect(report).toContain(required);
    }
  });

  it("counts consumer-owned coordination matching the sources on disk", () => {
    const headless = sourceLines(join(repoRoot, "examples", "review-headless"));
    const baseline = sourceLines(join(repoRoot, "examples", "review-baseline"));
    // both measured counts must appear in the report, labelled per implementation
    expect(report).toMatch(new RegExp(`headless[^\\n]*${headless}\\s*$`, "m"));
    expect(report).toMatch(new RegExp(`baseline[^\\n]*${baseline}\\s*$`, "m"));
  });

  it("records core changes and an explicit distribution decision", () => {
    expect(report).toContain("## Core changes required");
    const decision = report.match(
      /## Decision\s*\n\s*(proceed|revise|narrow|defer)\b/,
    );
    expect(
      decision,
      "report must record an explicit proceed/revise/narrow/defer decision",
    ).not.toBeNull();
  });

  it("claims reuse only with both favorable conditions recorded", () => {
    // a favorable claim requires BOTH: no new core behavior and less
    // consumer-owned coordination than the baseline; the report must state
    // each condition's verdict explicitly, not just the headline decision
    expect(report).toMatch(/no new core behavior[^]*?:\s*(yes|no)/i);
    expect(report).toMatch(/less consumer-owned coordination[^]*?:\s*(yes|no)/i);
  });
});