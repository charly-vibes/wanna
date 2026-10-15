# Tasks: shell distribution artifact

Beads is the durable task tracker. Tickets below are filed when the proposal is
approved; each maps to a red→green→refactor cycle. No publication step exists
in any ticket.

## 1. Fresh-consumer verification (RED first)

Tests live in `tests/distribution/`.

- 1.1 `wanna-<red>` — fresh-consumer test: compile a minimal consumer importing
  the emitted `@wanna/composition-shell` entry point and declarations, with
  repo aliases and `src/` inaccessible; the harness installs no ambient types
  beyond its own (catches `@types/node`/test-global leakage in declarations).
  The test invokes the emit step (build script) itself. RED: no emission
  exists. Scenario bindings: fresh-consumer-imports-entry,
  declarations-typecheck-standalone
  (`.espectacular/changes/add-shell-distribution/`).

## 2. Build emission (GREEN)

- 2.1 `wanna-<build>` — build configuration compiling only package sources
  (esbuild single-file ESM bundle + tsc declarations; artifact named
  `@wanna/composition-shell`); emitted types exclude test globals
  (consumer-compile test asserts no vitest globals leak); `exports` map admits
  only the shell barrel; zero runtime dependencies asserted by a static check.
- 2.2 `wanna-<docs>` — runtime matrix documented (supported/unsupported
  combinations) in the package README section; publication remains explicitly
  unauthorized, recorded in the doc.
- 2.3 `wanna-<tidy>` — separate tidy commit: root tsconfig/gates unaffected,
  dist/ gitignored, lefthook unaffected (no new gates), eslint boundary check
  extended to the build config.

## 3. Conformance

- 3.1 `wanna-<gate>` — scenario contracts bound via overlay
  `ah check --changes add-shell-distribution --run-tests`; spk lint; openspec
  validate --all --strict.
