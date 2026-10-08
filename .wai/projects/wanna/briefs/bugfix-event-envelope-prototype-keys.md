# Subagent brief: prototype-key bug in event-envelope (found by fast-check)

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`.
A fast-check property run exposed a genuine latent bug. You own the fix
end-to-end including the commit. Orchestrator verifies with real gates.

## The bug (confirmed counterexample)
`tests/event-envelope/properties-pbt.test.ts` property
`TypeScript conformance test: assert invariant stale_events_rejected at its
trust boundary and under its stated edge cases.` fails with:
- envelope `eventId: "constructor"` + context `committedEventIds:
  ["constructor"]`, `currentTaskRevision: "!"`, envelope
  `expectedTaskRevision: "!"`.
- `reduceEvent` returned `{ ok: true, state: 'duplicate' }` — expected
  `{ ok: false, code: 'stale_revision' }`.
- Root cause (verify yourself before fixing): committed-event membership is
  checked via a plain object (`committed[eventId]`-style), so `"constructor"`
  is truthy via `Object.prototype` — the duplicate check fires before the
  staleness check. Any prototype-inherited key (`constructor`, `toString`,
  `valueOf`, `__proto__`, `hasOwnProperty`) can collide.

## Fix requirements
1. Use a real `Set`/`Map` (or `Object.hasOwn` guard) so prototype keys cannot
   collide. Fix ALL object-as-lookup-table sites in `src/event-envelope/`.
2. Add regression coverage: pin the exact `"constructor"` counterexample as a
   deterministic unit test in `tests/event-envelope/` asserting
   `stale_revision` takes precedence per the spec's guard order — and keep the
   fast-check property (do NOT weaken or special-case it).
3. Scan the other implemented specs' src for the same pattern
   (`grep -rn "\[.*Id\]" src/ | grep -v Set | grep -v Map` style sweep); if you
   find identical object-as-set membership checks elsewhere, fix them the same
   way in the SAME commit series — this is a repo-wide correctness bug class.
4. Commit conventional `(wanna-bugfix)` or attribute to the right spec;
   stage ONLY your files.

## Gates (all must pass)
- `npx vitest run` — full suite green, PBT property included
- `ah check --run-tests` — exit 0, 0 findings (rerun once on transient "-122 write")
- `npx tsc --noEmit` — zero errors
- `spk lint openspec`, `pretender check src tests`, `npx eslint src tests` — clean

## Rules
No push, no bd, no wai close. No new deps. No spec/contract edits.

## Report format
## Report — **Commits**, **Gates**, **Fixes** (files + the pattern fixed),
**Deviations**, **Next**.