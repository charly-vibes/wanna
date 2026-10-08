# Sentinel RED evidence — wanna-y8j (2026-10-10)

## Setup

Sentinel test `it("sentinel intentionally failing", () => expect(1).toBe(2))` was added temporarily to `tests/composition-shell/consumer.test.ts`, and bound via the change overlay contract `.espectacular/changes/add-composition-shell/composition-shell/no-host-imports-in-the-shell-module.toml` with `[[tests.vitest]] flags = "--testNamePattern=sentinel intentionally failing"`.

## Command

```
ah check --changes add-composition-shell --run-tests
```

## Result (exit 1)

```
execution: composition-shell/no-host-imports-in-the-shell-module — test-failing
  stderr: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
  stderr:  FAIL  tests/composition-shell/consumer.test.ts > composition-shell consumer contract > sentinel intentionally failing
summary: 362 passed, 22 structural, 1 execution, 0 quality
```

## Reading

- The contract executed the vitest runner with the scenario-scoped `--testNamePattern`; the failing sentinel was the only test executed in its file (all others skipped).
- `ah check` classified it `execution: test-failing` and named the exact test (`FAIL tests/composition-shell/consumer.test.ts > composition-shell consumer contract > sentinel intentionally failing`).
- Falsifiability proven: the harness path reports a deliberately failing consumer test.

## Restoration

The sentinel was removed and the contract rebound to the real implemented property test `composition shell module imports no host or transport modules` (passes; overlay run: 363 passed, remaining findings are the expected pre-implementation `no-toml` for the 22 unimplemented change scenarios).
