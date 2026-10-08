# RED evidence — wanna-9wu consumer-behavior contract (2026-10-10)

## Setup

`tests/composition-shell/consumer-behavior.test.ts` declares 11 executable
consumer tests (one per consumer-example.md outcome row). In its committed state
the suite is guarded by a one-time behavior probe
(`probeBehaviorLanded()` attempts `openReviewSession` on a fake port and detects
the scaffold's `not implemented` error) via `describe.skipIf(!behaviorLanded, …)`.

To prove falsifiability, the guard was **temporarily forced open**
(`const behaviorSuite = describe;` instead of `describe.skipIf(…)`), the file was
executed, and the guard was restored afterwards. No other file changed.

## Command

```
npx vitest run tests/composition-shell/consumer-behavior.test.ts
```

## Result (exit 1)

```
 ❯ tests/composition-shell/consumer-behavior.test.ts (11 tests | 11 failed)

 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 11 ⎯⎯⎯⎯⎯⎯⎯
 FAIL tests/composition-shell/consumer-behavior.test.ts > composition-shell
      consumer behavior (consumer-example.md) > first-review — …
 Error: not implemented: wanna-0te (declared-port open/load)
 … (identical shape for all 11)

 Test Files  1 failed (1)
      Tests  11 failed (11)
```

## Failure classification

| Check | Result |
|---|---|
| Failing tests | 11 / 11 (all scenario rows) |
| Failures with `not implemented` (missing behavior) | 11 |
| Harness / import / transform / type errors | 0 (`grep -ciE "cannot find|typeerror|undefined is not|import.*failed|transform failed"` → 0) |
| Non–`not implemented` `Error:` lines | 0 |

Every failure is the scaffold's missing-behavior error thrown by
`openReviewSession` (`not implemented: wanna-0te (declared-port open/load)`),
i.e. the RED state is caused by unimplemented shell behavior, never by the test
harness itself. Zero failures stem from import resolution or test plumbing.

## Reading

- The consumer contract is falsifiable: when shell behavior is absent, forcing
  the guard yields pure missing-behavior failures.
- The committed guard (`describe.skipIf`) keeps the default `npm test` suite
  green (11 skipped) until wanna-0te/15e/8k6/gcp land behavior, at which point
  the probe auto-enables the suite and the owning tickets remove the probe.

## Restoration

The guard was restored to `describe.skipIf(!behaviorLanded, …)`; final suite
state: 11 skipped, full `npx vitest run` green.
