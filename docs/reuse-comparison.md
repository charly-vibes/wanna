# Reuse comparison: composition shell vs direct implementation

Evidence record for `add-workbench-spa:3.1` (wanna-zcq). The second consumer is a
headless review client over the same public shell and durable adapter; the
baseline is a small application-specific implementation satisfying the identical
acceptance scenarios. A favorable reuse claim requires **no new core behavior**
for the second consumer **and** less consumer-owned coordination than the
baseline; otherwise the recorded decision is revise, narrow, or defer.

## Comparison protocol

Defined before either implementation was graded:

- **Identical acceptance scenarios** — both implementations run the same
  current/stale/restart suite (`tests/review-workbench/reuse-scenarios.ts`,
  executed by `tests/review-workbench/reuse-comparison.test.ts`):
  1. **current** — an active review of revision 7 records feedback tied to
     revision 7; re-delivering the same event id is a duplicate and never
     creates a second completion.
  2. **stale** — an artifact advance to revision 8 rejects the in-flight
     submission as stale (never a silent retarget), preserves the pending
     revision-7 review, and requires an explicit fresh review of revision 8
     before a submission against it records.
  3. **restart** — a fresh client process over the same durable storage
     restores completed history; re-delivery of an acknowledged-elsewhere
     event never duplicates a completion.
- **Metrics** — consumer-owned coordination lines (every line in the
  implementation's own sources: flow control, outcome mapping, state decisions),
  public-surface import count, test outcomes, and implementation time.
- **Exclusions** — declared below; identical test infrastructure and fixtures
  are shared and counted in neither implementation.
- **Integrity rules** — the core must not be modified to manufacture a reuse
  success; both implementations must pass the same suite unmodified; the report
  numbers are checked against the sources on disk by
  `tests/review-workbench/reuse-report.test.ts`.

## Initial effort

(wanna-01q + wanna-9r2 + wanna-snh + wanna-gcp landed the shell, adapter and
first screen consumer; recorded here as the baseline construction cost.)

- Shell + durable adapter + first screen consumer: 5 tickets, 4 commits
  (`dd41405`, `0116865`, `29a9661`, plus the shell itself).
- The first consumer (review-workbench) is the initial-effort reference: its
  coordination lives in `examples/review-workbench/handlers.ts` + `dom.ts` +
  `screen.ts` (~490 lines including DOM rendering).

## Marginal second-consumer effort

Measured in this ticket, from empty directory to green suite:

- Headless consumer (`examples/review-headless`): 186 lines, one file.
- Direct baseline (`examples/review-baseline`): 189 lines, one file (159 lines
  before the repo's function-size gate forced a helper split — the split added
  structural plumbing, no semantics).
- Wall-clock time: one session (~1 h) for protocol, RED, both implementations
  and this report — see Author familiarity for why this is indicative only.
- Suite outcome: 6/6 identical scenarios pass for both implementations;
  both implement idempotent reopen (duplicate-tolerated first path).
- Core changes required: none — see Core changes required.

## Author familiarity

Disclosure: the author of both implementations is the same agent that authored
the shell, adapter and first consumer across this change — familiarity is
**high** for the shell path and typical for a fresh baseline. Time comparisons
are therefore indicative, not absolute; the coordination-line and import counts
are the primary metrics.

## Excluded costs

Not counted for either implementation:

- Test infrastructure (`reuse-scenarios.ts`, the comparison test file, fixture
  data) — shared by both, owned by the evaluation.
- Storage drivers: the IndexedDB adapter is reused unmodified by the headless
  consumer (that reuse is the point); the baseline's JSON-map store stands in
  for a persistence layer it would otherwise also need. **This exclusion
  flatters the baseline**: a store that can fail, conflict or lose
  acknowledgements would force the baseline to grow unavailable/unknown-effect
  handling, receipts and conditional writes that the shell already owns.
- DOM rendering, browser bundling, packaging and distribution (owned by
  wanna-zbn if the decision is proceed).
- Fault-injection demo controls present in the first consumer.

## Consumer-owned coordination

Every line of the implementation's own sources (declarations, flow control,
outcome mapping; no shell or adapter internals — they are reused):

- headless shell consumer: 186
- direct baseline: 189

Public-surface imports (headless consumer): exactly one —
`@wanna/composition-shell` (the storage port is injected, so no adapter import
is needed; the same allowed set as the first consumer, enforced by the
consumer public-surface scan extended to this example). The baseline imports
only the shared scenario result type from the test infrastructure.

Breakdown: headless ≈50 lines of typed outcome surface (including
`unavailable`/`unknown_effect` variants the shell can produce and a real host
must handle) + ≈135 lines of flow/outcome-mapping coordination. Baseline ≈40
lines of state declarations + ≈150 lines implementing the same three flows
against a store that never fails (of which ≈30 are gate-forced helper plumbing,
not semantics — pre-split the semantic content was ≈115 lines).

## Core changes required

None. `src/` is untouched by this ticket (verified via git status at report
time): every semantic rule the scenarios exercise — stale detection, event-id
deduplication across restart, resume, retire-then-fresh-review, outcome
vocabulary — came from the shell's public API. No new core behavior was needed
for the second consumer.

## Favorable-claim conditions

- No new core behavior required: yes
- Less consumer-owned coordination than baseline: yes — on-disk 186 vs 189,
  but the 3-line margin is formatting noise (the baseline's gate-forced helper
  split adds ≈30 structural lines; pre-split it was 159). The honest reading:
  the LOC condition is inconclusive on this bounded slice, and the excluded
  trivial baseline store flatters the baseline further (see Excluded costs)

## Decision

narrow — reuse is demonstrated on semantic coordination (one public-barrel
import, zero core changes, every acceptance rule owned by the shell) but the
raw coordination-line evidence is inconclusive: the on-disk margin (186 vs
189) is formatting noise, and the baseline store excludes the failure modes
that make the shell's coordination pay off. Distribution (wanna-zbn) may not
proceed on this LOC evidence; before revisiting, either (a) re-run the
comparison with a realistic baseline store (can fail, conflict, lose
acknowledgements) so exclusions stop flattering it, or (b) narrow the
distribution claim to semantic reuse. Report existence is nonetheless complete
per the change: archival does not depend on a favorable outcome.