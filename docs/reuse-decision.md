# Reuse decision record

Final decision record for the reuse-comparison claim (wanna-zh1), superseding
the open-ended decision section in `docs/reuse-comparison.md` with respect to
path (b) — narrowing. Path (a), a realistic-baseline re-run, is deferred with
a recorded protocol, not refused.

## Decision: the narrow claim is final for this corpus revision

The distribution and reuse claims for the composition shell are scoped to
**semantic reuse** and that scope is accepted as final until the deferred
experiment below produces contrary evidence:

> Reuse is demonstrated on semantic coordination — one public-barrel import,
> zero core changes for every consumer, every acceptance rule owned by the
> shell's public API — while consumer-coordination-line (LOC) savings remain
> unproven on the measured slice.

Two independent evidence passes converge on this:

1. **wanna-zcq comparison** (`docs/reuse-comparison.md`): headless consumer
   196 lines vs direct baseline 190 — the 3-line on-disk margin is gate-forced
   formatting noise; the excluded trivial baseline store flatters the
   baseline; no core behavior was added for the second consumer.
2. **wanna-vlt global evaluation** (2026-10-19,
   `.wai/projects/wanna/research/2026-10-19-global-value-spa-evaluation-wanna-vlt-best-supp.md`):
   an independent browser-level evaluation that did not set out to grade reuse
   reached the same boundary — the strongest supported proposition is
   "reusable, revision-aware human review coordination with durable outcomes
   and explicit recovery"; the reuse comparison "explicitly narrows evidence
   to semantic reuse; LOC savings inconclusive"; broader amplification and
   lower-integration-cost claims remain unproven.

Distribution already reflects this scope (wanna-zbn decision record:
semantic-reuse claim; `@charly-vibes/wanna` published under separately
authorized publication). No further narrowing is taken here.

## Deferred experiment: realistic-baseline re-run (path a)

Not cancelled — deferred behind the browser-fidelity fixes it depends on,
with the protocol recorded so it can be picked up without re-derivation:

**Preconditions (landed as of this record)** — the wanna-vlt browser findings
are closed: feedback entry works (wanna-6ce), lose-ack persists and
reconciles to `applied` (wanna-5xi), the demo fits a mobile viewport
(wanna-hbm).

**Protocol** (from the wanna-vlt recommendation): run the same review task
through the shell path and a *failure-capable* baseline store, comparing —
not only coordination lines but task-level outcomes:

- wrong-revision writes (must be typed stale, never silent retarget)
- duplicate writes (never a second completion)
- draft loss on stale rejection (preserved draft, explicit fresh review)
- recovery completion and time after a lost acknowledgement
- consumer coordination effort (lines and decision points)

**Gate for revisiting the claim**: if the failure-capable baseline needs
materially more consumer coordination than the shell path, the LOC evidence
flips and the reuse claim can be widened beyond semantic reuse.

## wanna-tambor adapter shape (recorded, not built)

The adapter prototype is recorded as a shape, not a package: a thin
**tambor-side** host glue that mounts the wanna shell through tambor widgets.
wanna stays headless — the adapter must never make wanna depend on tambor;
tambor is a rendering host, wanna is the coordination core.

Two independent artifacts already exercise the same seam and agree on it:

1. **wanna-72s demo** (`examples/review-tambor` + `page/review-tambor/mount.ts`,
   deployed at the gh-pages demo): tambor `DomBackend` + `realDomFactory`
   over the shell's public surface via the `makeOpsApp` seam; the shell's
   typed outcomes map one-to-one onto tambor effect lists; the durable port
   is injected by the host (the IndexedDB adapter); no shell semantics are
   re-implemented in the view layer.
2. **tambor chat-repo cold read prototype**
   (`docs/reference/chat-repo-cold-read/artifacts/wanna-on-tambor.html.txt`,
   charly-vibes/tambor): an independently written ~40-line mini-tambor host
   + fresh durable port + the shell's typed outcomes treated as contracts —
   the same direction of dependency, derived from tambor's side.

Adapter shape, as the two artifacts converge on it:

- **Ownership**: host owns rendering (tambor widgets) + port injection;
  wanna shell owns stale detection, dedup, resume, retire/fresh-review,
  typed outcome vocabulary. The host maps outcomes to effect lists and
  nothing else.
- **Dependency direction**: `tambor → adapter → wanna`; wanna imports
  neither.
- **Known workaround**: until tambor#1 ships (tracked as wanna-1ha), real-DOM
  hosts need the CELL_SCALE presentation wrapper carried in
  `page/review-tambor/mount.ts` — a prototype should either reuse it or wait
  for the upstream fix.

## Record

- Decision date: 2026-10-20 (wanna-zh1)
- Evidence: wanna-zcq comparison report, wanna-vlt evaluation,
  wanna-72s demo, tambor cold-read prototype
- Supersedes: the open "either (a) or (b)" wording in
  `docs/reuse-comparison.md` (decision section) with respect to (b);
  (a) is deferred with the protocol above
