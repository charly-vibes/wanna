// Purpose: static emission checks for the shell artifact (add-shell-distribution 2.1)
// Responsibilities: falsifiably bind package-dependency-free (zero runtime
// dependencies and no external imports in the bundle) and single-public-entry
// (exports map admits only the shell barrel); the manifest write step is the
// mutation target for both
// Rationale: openspec/changes/add-shell-distribution/specs/shell-distribution/spec.md
import { readFileSync } from "node:fs";
import path from "node:path";
// describe/expect resolve through vitest globals (globals: true in vitest.config.ts)

const REPO = path.resolve(import.meta.dirname, "../..");
const DIST = path.join(REPO, "dist");

describe("emitted artifact manifest (add-shell-distribution)", () => {
  const manifest = JSON.parse(readFileSync(path.join(DIST, "package.json"), "utf8")) as {
    name: string;
    dependencies?: unknown;
    peerDependencies?: unknown;
    exports: Record<string, unknown>;
  };
  const bundle = readFileSync(path.join(DIST, "index.js"), "utf8");

  it("package declares zero runtime dependencies (package-dependency-free)", () => {
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest.peerDependencies ?? {}).toEqual({});
    // a bundled runtime artifact resolves nothing at run time: no import
    // statements may remain (re-exported specifiers would be an external dep)
    expect(bundle.match(/^import /m)).toBeNull();
  });

  it("exports map admits only the shell public barrel (single-public-entry)", () => {
    expect(manifest.name).toBe("@wanna/composition-shell");
    expect(Object.keys(manifest.exports)).toEqual(["."]);
  });

  it("runtime matrix records supported and unsupported combinations (runtime-matrix-recorded)", () => {
    const matrix = readFileSync(path.join(DIST, "RUNTIME-MATRIX.md"), "utf8");
    // supported side recorded
    expect(matrix).toMatch(/## Supported[\s\S]*Node\.js >= 20/);
    expect(matrix).toMatch(/## Supported[\s\S]*ESM-aware bundlers/);
    // explicitly unsupported side recorded with no compatibility commitment
    expect(matrix).toMatch(/## Explicitly unsupported[\s\S]*CommonJS require/);
    expect(matrix).toMatch(/## Explicitly unsupported[\s\S]*UMD/);
    expect(matrix).toMatch(/## Explicitly unsupported[\s\S]*native ESM support/);
    // publication remains separately unauthorized, recorded in the artifact doc
    expect(matrix).toMatch(/separately authorized/);
  });

  it("no task, script, or gate publishes to a registry (no-publication-step)", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(REPO, "package.json"), "utf8"),
    ) as { scripts: Record<string, string>; private: boolean };
    const scriptKeys = Object.keys(manifest.scripts);
    expect(
      scriptKeys.filter((key) => /publish|release/i.test(key) || /publish|release/i.test(manifest.scripts[key] ?? "")),
    ).toEqual([]);
    // the emitted artifact is never a publish step either
    const buildScript = manifest.scripts["build:dist"];
    expect(buildScript).toBeDefined();
    expect(buildScript).not.toMatch(/publish|npm publish|release/i);
    expect(manifest.private).toBe(true);
  });
});
