# Composition Shell — Surface Compatibility Record

Recorded compatibility decisions for revisions that change the shell's input,
output or effect semantics ([[composition.shell.shell_surface_versioned]]).
The newest decision is first.

## 0.2.0 — additive lifecycle surface (wanna-gcp)

- **Decision:** additive. The 0.1.0 surface is fully preserved; no input,
  output or effect semantics of existing commands changed.
- **Added:** the explicit `cancel` command on `ReviewSessionShell`
  ([[composition.shell.retirement_explicit]]) with `CancelCommand` and
  `CancelOutcome` (`retired` | `stale` | `duplicate` | `unavailable` |
  `unknown_effect`); the `retiredReviews` field on `ReviewProjection`.
- **Added (behavioral):** after a cross-writer state-precondition rejection the
  shell refuses further mutations with `stale` until `refresh` delivers a fresh
  authoritative snapshot ([[composition.shell.refresh_requires_new_snapshot]]);
  after an unknown commit effect the shell refuses further mutations with
  `unknown_effect` until `reconcile` proves application or non-application
  ([[composition.shell.uncertain_effect_blocks_mutation]]). These refusals
  happen before any port contact and never authorize retry by themselves.
- **Migration note:** consumers that only used open/evaluate/commit/submit/
  project need no changes. Consumers wanting retirement call
  `shell.cancel({ operationId, interactionId })` instead of constructing
  consumer-side extensions (the transitional `ExplicitCancelShell` support
  type is retired with this revision). Consumers that present review history
  can now read `projection.retiredReviews`; retired reviews no longer appear
  only through the `retired` projection status.