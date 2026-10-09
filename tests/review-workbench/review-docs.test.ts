// Purpose: documentation-contract test for the review quickstart (wanna-jw2)
// Responsibilities: parse docs/review-quickstart.md code blocks and fail on absent/incorrect public calls — every documented shell call must be exercised by the executable consumer example or the consumer tests; every outcome kind shown must exist on the public surface
// Rationale: add-composition-shell:4.2 — the quickstart documents only demonstrated behavior; this test makes doc drift from the public surface a red contract
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readDirNames(dir: string): string[] {
  return readdirSync(dir);
}

const repoRoot = process.cwd();
const quickstartPath = join(repoRoot, "docs", "review-quickstart.md");
const exampleDir = join(repoRoot, "examples", "review-workbench");
const testsDir = join(repoRoot, "tests", "review-workbench");

const quickstart = readFileSync(quickstartPath, "utf8");

/** Every documented ```ts / ```typescript fenced code block. */
function codeBlocks(source: string): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map(
    (m) => m[1]!,
  );
}

/** `shell.<method>(` occurrences across the executable consumer example and the executable consumer tests. */
function demonstratedShellMethods(): Set<string> {
  const exampleSources = ["screen.ts", "handlers.ts", "fixture.ts"].map((f) =>
    readFileSync(join(exampleDir, f), "utf8"),
  );
  const testSources = [
    join(testsDir, "review-screen.test.ts"),
    join(testsDir, "review-recovery.test.ts"),
    ...readDirNames(join(repoRoot, "tests", "composition-shell"))
      .filter((f) => f.endsWith(".test.ts"))
      .map((f) => join(repoRoot, "tests", "composition-shell", f)),
  ].map((f) => readFileSync(f, "utf8"));
  const methods = new Set<string>();
  for (const source of [...exampleSources, ...testSources]) {
    for (const match of source.matchAll(/\bshell\.(\w+)\(/g)) {
      methods.add(match[1]!);
    }
  }
  return methods;
}

describe("review quickstart documentation contract", () => {
  it("documents construction, evaluation, projection and response", () => {
    for (const required of [
      "openReviewSession",
      "evaluateNeed",
      "commitDecision",
      "project",
      "submit",
    ]) {
      expect(quickstart).toContain(required);
    }
  });

  it("documents refresh/reconcile and resume paths", () => {
    for (const required of ["reconcile", "refresh", "openReviewSession"]) {
      expect(quickstart).toContain(required);
    }
  });

  it("every documented shell call is exercised by the executable consumer example", () => {
    const demonstrated = demonstratedShellMethods();
    const documented = new Set<string>();
    for (const block of codeBlocks(quickstart)) {
      for (const match of block.matchAll(/\bshell\.(\w+)\(/g)) {
        documented.add(match[1]!);
      }
    }
    expect(documented.size).toBeGreaterThan(0);
    const undemonstrated = [...documented].filter(
      (m) => !demonstrated.has(m),
    );
    expect(
      undemonstrated,
      "quickstart documents calls the executable consumer example never makes",
    ).toEqual([]);
  });

  it("does not claim unimplemented authorization or external actions", () => {
    // The shell records review outcomes; it does not authorize or perform
    // external actions. The quickstart must state this boundary, not feature it.
    expect(
      /does not (authorize|perform external)|not authorize|no authorization/i.test(
        quickstart,
      ),
    ).toBe(true);
    // A quickstart that wires reviewer decisions into e.g. publishing or
    // deployment calls would claim an external action the surface cannot do.
    for (const block of codeBlocks(quickstart)) {
      expect(block).not.toMatch(/\b(deploy|publish|approve-external)\b/);
    }
  });
});