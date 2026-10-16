# Design: Shell Distribution

## Context

The shell exists as in-repo source (`src/composition-shell/` + the four layer
barrels it composes: session-state, interaction-need, interaction-policy,
engine). Consumers resolve `@wanna/composition-shell` through tsconfig paths and
a vitest alias pointing at source files. The reuse report (narrow decision)
justifies distributing the semantic coordination only.

## Decisions

### D1: Single package, shell barrel only

The demonstrated consumer imports exactly one public barrel. The smallest
topology that supports it is one package exposing that barrel — not a workspace
split (no demonstrated need; the acceptance criteria require one) and not a
multi-package fan-out of the four composed layers (they are internals of the
shell's composition, not independently demonstrated public surfaces).

The `@wanna/review-indexeddb` adapter is deliberately left out: it is the
consumer-owned durable backend demonstrated by the workbench, and packaging it
would assert IndexedDB as a supported durable port for all consumers — a claim
no evidence carries. It remains in-repo reference material.

### D2: esbuild runtime bundle + tsc declarations

Terminology: the **build config** produces the **emission** (`dist/`), which is
the **artifact** consumers import.

The runtime JavaScript is bundled to a single ESM file with esbuild (a
dev-only build dependency — zero *runtime* dependencies stays true). Plain
Node ESM cannot resolve the extensionless relative imports the sources use
(`from "./types"` et al.), and tsc emits import specifiers verbatim, so
tsc-only multi-file emission would contradict the promised Node ESM support.
Declarations are emitted by `tsc --emitDeclarationOnly` from the same build
unit, giving a single entry `.d.ts` that matches the bundled entry.

The emitted artifact carries package name `@wanna/composition-shell` — the
import the demonstrated consumer already uses — with an `exports` map admitting
only `"."`. The fresh-consumer verification resolves it from `dist/` via a
temporary `file:` install (or equivalent dist-relative resolution) so no repo
alias or `src/` access is involved. A workspace split still requires
demonstrated need; revisit only if a documented consumer need appears.

### D3: Build config is a separate compile unit

The root tsconfig carries `types: ["vitest/globals", "node"]` and includes
`tests/` and `examples/`. The build configuration compiles only the package
sources with node types only, so test globals cannot leak into emitted
declarations. Root `noEmit` stays; the build config sets `outDir: dist`.

### D3b: Build-before-test

The fresh-consumer test invokes the emit step itself (the `build` npm script)
rather than assuming `dist/` exists, so a clean checkout fails the test only
if the build is genuinely broken. No new lefthook gate: the test rebuilds
deterministically before asserting.

### D4: Fresh-consumer verification as the executable gate

The RED test: compile a minimal consumer that imports the emitted entry point
and typechecks against the emitted declarations, with `src/` inaccessible
(no aliases). Before emission exists it fails; after emission it passes. This
is the falsifiable boundary of the whole change — dist/ absence, a leaked test
global in declarations, or a runtime dependency each turn it red.

### D5: Runtime matrix is documentation, not support promises

Supported: ESM import in Node.js ≥ 20 (tested on the current dev version,
Node 26), and ESM-aware bundlers. Explicitly unsupported: CommonJS require,
UMD, browsers without native ESM support, and TypeScript below the emitted
target. Documenting the matrix is a requirement; promising fixes for
unsupported combinations is not.

The package's artifact version starts at 0.1.0 and is scoped to the emitted
package; the API surface version stays 0.3.0, governed by the shell's
compatibility record. The two version axes are independent.

## Non-goals

- Registry publication, npm provenance, release automation (wanna-zbn gate).
- Packaging the adapter, the workbench screen, or any non-shell capability.
- Bundling concerns beyond the single-entry ESM file (tree-shaking guarantees,
  minification) — revisit on demonstrated consumer need.
- Changes to any deployed spec semantics (surface stays 0.3.0; compatibility
  record untouched — packaging changes no input/output/effect semantics).
- Workspace split or package-manager workspace migration.
