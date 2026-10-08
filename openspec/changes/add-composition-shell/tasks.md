# Tasks: deliver the artifact-review slice

Beads is the durable task tracker. References below map the approved proposal to
its tickets; implementation remains pending approval of the revised proposals.
Each behavior ticket writes failing expectations first, implements the smallest
passing path, and leaves structural tidying to the separate refactor ticket.

## 1. Contract before behavior

- [x] 1.1 Define revision-bound review experience, mappings, policy ownership and
      expected outcomes in proposal/design/consumer-example/delta (wanna-40i).
- [x] 1.2 Specify persistence operations, conditional commits, dedup scope and
      authoritative reconciliation with typed outcomes (wanna-d0h).
- [x] 1.3 Scaffold public types and consumer conformance harness; prove its failing
      sentinel is executed and reported; bind actual behavior as it lands (wanna-y8j).
- [ ] 1.4 Make consumer-example.md an executable failing public-API contract;
      specify happy path and failure inputs/outputs before implementation (wanna-9wu).

## 2. First human review

- [ ] 2.1 RED→GREEN: declared-port construction/load and host-neutral public
      interface, with no implicit persistence (wanna-0te).
- [ ] 2.2 RED→GREEN: need normalization → catalog/policy eligibility → engine;
      explicit mappings, empty result and preserved evidence/version pins (wanna-15e).
- [ ] 2.3 RED→GREEN: initial decision freshness and current response completion
      through atomic conditional aggregate/replay/receipt commits (wanna-8k6).

Companion add-workbench-spa:1.1 builds the durable adapter after the API contract;
1.2 builds the minimal screen as the first path becomes available. Neither depends
on packaging. A first-path demonstration is not final delivery.

## 3. Recovery and lifecycle

- [ ] 3.1 RED→GREEN: observational projection, permitted retirement after display,
      explicit supersession, refresh, restart and uncertain-effect reconciliation
      without automatic rebinding of stale feedback (wanna-gcp).

Companion add-workbench-spa:2.1 proves these behaviors through the real durable
adapter, independent clients and browser reload, including stale initial decisions.

## 4. Quality and handoff

- [ ] 4.1 Separate tidy ticket/commit after consumer acceptance; retain behavior
      and rerun existing contracts, or record no justified refactor (wanna-lwo).
- [ ] 4.2 Quickstart from the executable example, truthful README implementation
      status and provisional v0 compatibility decision (wanna-jw2).
- [ ] 4.3 Complete property bindings and execute corpus + consumer gates; inject
      one semantic violation, prove ah check --run-tests reports it, and restore
      green (wanna-2o8; shared with add-workbench-spa:2.2).

Use spk lint openspec, strict OpenSpec validation of both changes, tsc, eslint, pretender, vitest and
ah check / ah check --run-tests with change overlays as appropriate. Structural
correspondence alone is not behavioral proof. Promote/archive only after the whole
change and companion acceptance obligations are complete.

## Follow-on distribution

The second consumer and baseline comparison are add-workbench-spa:3.1 (wanna-zcq).
Packaging wanna-zbn depends on its recorded proceed decision. Workspace splitting,
fresh-package checks and publication are not prerequisites for this review slice.

## Existing validation baseline

At proposal revision, strict validation passes both changes. Full-repository
OpenSpec validation fails on required sections in all 30 unchanged deployed specs;
wanna-bql tracks that independent repair. Report that baseline explicitly in
verification evidence; do not claim full OpenSpec success or weaken the new-change
checks. Specodelic corpus lint passes with three existing observability advisories.
