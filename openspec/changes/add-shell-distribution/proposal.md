# Add Shell Distribution as an Importable Package Artifact

## Why

wanna-zbn's reuse gate recorded a **narrow** decision: reuse is demonstrated on
semantic coordination (the headless consumer imports one public barrel
`@wanna/composition-shell`, makes zero core changes, and every acceptance rule is
owned by the shell), but the coordination-line evidence is inconclusive, so
full coordination-line distribution stays gated on a realistic-baseline
comparison. Per the recorded revisit path (b), the distribution claim is
narrowed to the semantic reuse that was actually demonstrated. Today a fresh
consumer cannot use the shell at all: it exists only as in-repo source resolved
by repo path aliases, so the demonstrated "one public barrel" reuse stops at
the repo boundary.

## What Changes

- Add `shell-distribution`, a packaging capability: emit the composition shell
  subtree (the shell barrel plus the layer barrels it composes) as a compiled
  ESM artifact with declarations, importable by a fresh consumer outside the
  repository aliases.
- Single-package topology: the first package exposes only the shell public
  barrel. The `@wanna/review-indexeddb` durable adapter stays in-repo as
  reference material — packaging it would commit to IndexedDB as a supported
  durable backend, a product claim its reuse evidence does not carry.
- Build emission is separated from the test workspace: a build configuration
  that compiles only the package sources and excludes test roots and test
  globals (vitest globals currently reach the emitted types through the shared
  tsconfig `types` array). The emitted artifact is named
  `@wanna/composition-shell`, matching the import the demonstrated consumer
  already uses; a fresh consumer resolves it from `dist/` without the repo
  aliases.
- The runtime JavaScript is bundled to a single ESM file (esbuild, dev-only) so
  plain Node ESM can resolve it — source uses extensionless relative imports
  that tsc emits verbatim and Node cannot resolve — with tsc emitting the
  matching declarations. Zero runtime dependencies is preserved: the bundler
  is a build-time dev dependency only.
- Document the supported runtime/module combinations explicitly (ESM only:
  Node.js ≥ 20 — tested on the current dev version — and ESM-aware bundlers);
  every other combination (CommonJS require, UMD, non-ESM browsers) is out of
  support.
- Publication is NOT part of this change: no registry push, no release
  automation, no version-bump ceremony. The change emits and verifies the
  artifact; publication remains a separately authorized act (wanna-zbn's
  standing rule).

## Semantic-reuse scope (the narrow decision, operationalized)

The evidence supports distributing what was demonstrated:

- **In scope**: the shell's semantic coordination — open/evaluate/commit/submit
  with the declared persistence port, stale/duplicate/unknown-effect handling,
  restart and reconciliation — as one importable public barrel.
- **Out of scope**: coordination-line superiority claims (LOC margins), the
  workbench adapter as a package, the browser workbench screen, and any claim
  that the shell reduces custom coordination lines versus a realistic direct
  implementation.

## Impact

- Affected specs: `shell-distribution` (new).
- Affected implementation: `tsconfig.build.json` (or equivalent build config),
  `dist/` emission (gitignored), `package.json` export map, a fresh-consumer
  verification test in `tests/distribution/`, and documentation of the runtime
  matrix.
- Depends on: none — `add-composition-shell` and `add-workbench-spa` are
  archived and deployed; their specs are the shipped surface (0.3.0).
- Gate lineage: wanna-zbn re-evaluated 2026-10-14; this change operationalizes
  the recorded narrow decision. No published artifact results from this change.

## Success criteria

A fresh consumer, outside the repo aliases and with no access to `src/`, imports
the emitted entry point, typechecks against the emitted declarations, and runs
the headless consumer scenario through the emitted artifact. The emitted types
contain no test globals. The package carries zero runtime dependencies. The
supported runtime/module combinations are documented, and nothing is published.
