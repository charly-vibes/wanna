// Purpose: distribution emission step for the shell artifact (add-shell-distribution 2.1)
// Responsibilities: run the build unit (tsc declarations), bundle the runtime JS
// to a single ESM file (esbuild, dev-only), and write the artifact package
// manifest naming @wanna/composition-shell with an exports map admitting only
// the shell barrel and zero runtime dependencies
// Rationale: plain Node ESM cannot resolve the sources' extensionless relative
// imports and tsc emits specifiers verbatim, so the runtime artifact is a
// single bundled file; declarations come from the same restricted compile unit
// (openspec/changes/add-shell-distribution, design D2)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dirname, "..");
const dist = path.join(repo, "dist");

function run(command, args) {
  execFileSync(command, args, { cwd: repo, stdio: "inherit" });
}

mkdirSync(dist, { recursive: true });

// 1. declarations from the restricted compile unit (tests/examples/vitest excluded)
run("node", [path.join(repo, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"]);

// 2. single-file ESM runtime bundle of the public barrel
// (bin/esbuild is a native binary — invoked directly, not through node)
run(path.join(repo, "node_modules/esbuild/bin/esbuild"), [
  "src/composition-shell/index.ts",
  "--bundle",
  "--format=esm",
  "--platform=neutral",
  "--outfile=dist/index.js",
]);

// 3. artifact manifest: @wanna/composition-shell, exports map admits only the
//    barrel, zero runtime dependencies; publication remains separately
//    unauthorized (this script is never a publish step)
writeFileSync(
  path.join(dist, "package.json"),
  JSON.stringify(
    {
      name: "@wanna/composition-shell",
      version: "0.1.0",
      description: "Composition shell public surface for resumable artifact review (semantic-reuse distribution; wanna-zbn narrow decision)",
      type: "module",
      main: "./index.js",
      // declaration tree emitted by tsc preserves the source structure; the
      // entry matches the bundled entry
      types: "./composition-shell/index.d.ts",
      exports: {
        ".": {
          types: "./composition-shell/index.d.ts",
          default: "./index.js",
        },
      },
    },
    null,
    2,
  ) + "\n",
);

// 4. runtime matrix: supported and explicitly unsupported combinations;
//    publication remains a separately authorized act and is not prepared here
writeFileSync(
  path.join(dist, "RUNTIME-MATRIX.md"),
  `# Runtime matrix — @wanna/composition-shell

Artifact version 0.1.0 (artifact-scoped); the API surface version is governed by
the shell's compatibility record (0.3.0) and is independent of this number.

## Supported

- ESM import in Node.js >= 20 (emission tested on the current dev Node)
- ESM-aware bundlers

## Explicitly unsupported (no compatibility commitment in either direction)

- CommonJS require
- UMD
- Browsers without native ESM support
- TypeScript below the emitted target (ES2022)

## Publication

This artifact is emitted for fresh-consumer verification only. No registry
publication is performed, wired, or authorized by the distribution change
(wanna-zbn gate); publication is a separately authorized act.
`,
);

console.log("dist/ emission complete: @wanna/composition-shell (no registry publication)");
