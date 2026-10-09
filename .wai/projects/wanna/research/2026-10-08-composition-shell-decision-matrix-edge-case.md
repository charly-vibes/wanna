---
tags: [pipeline-run:wave-6-2026-10-08-wave-6-final-dus-7fe-504-via-pi-subagents]
---

# Composition Shell — Decision Matrix + Edge Case Discovery

Validates `openspec/changes/add-composition-shell/` before approval. Matrix follows
the design-review decision-matrix checks; scenarios follow the six-boundary
edge-case-discovery protocol. All CRITICAL/HIGH findings mechanically verified
against the delta spec and repo (grep/rg evidence inline).

---

## Part 1 — Decision Matrix

### Checks

- **Status Quo Baseline: PRESENT** (S0 column first).
- **Fact/Judgment Separation: CLEAN** — cells carry facts; judgment only via ◑ symbols.
- **Criteria Completeness: COMPLETE-ish** — includes maintenance burden, rollback
  difficulty, failure modes (the commonly-missing trio); team-expertise folded into
  corpus-discipline row.
- **Approach Diversity: DIVERSE** — S2 moves composition in-repo unregulated; S3
  pushes composition to consumers; S4 couples composition to transport. Not
  variations of one idea.

### Matrix (facts per cell; ◑ = favorable / ◐ = mixed / ○ = unfavorable judgment)

| Criterion | S0 Status quo | S1 Proposed: shell capability + workspaces | S2 Orchestrator module, no new spec | S3 Publish 30 packages, no shell | S4 Server-first, shell inside server |
|---|---|---|---|---|---|
| Composition exists today | Zero cross-layer imports (rg: 0 hits) | New `src/composition-shell/` + spec | New module, no spec | Never in-repo; every consumer composes | Inside server only |
| Conformance-gate coverage of composition | n/a — nothing composed | 12 scenarios + contract TOMLs, `ah check` gated | ○ No scenario/contract gate on composition code | ○ Same as S0 | Gate covers server, not composition |
| Time to human-testable e2e (Option A) | ○ Blocked indefinitely | Shell → SPA consumer (tasks 2→6) | Fast to code, ungated | ○ Slowest (30 publishes first) | Honest e2e, but SPA delayed |
| Distribution readiness | ○ Impossible (`private: true`, `noEmit`, vitest globals in src) | Workspaces + build in tasks phase 3; publish after | Same packaging work, worse surface (no stable API) | ◑ Fully distributed, but 30-version matrix | Distribution deferred |
| Drift/maintenance burden | 0 (nothing to drift) | Restated layer constraints risk drift → mitigated: tasks §2 binds restatements to owning barrels' constants | ○ Composition logic free to grow domain logic silently | 30 surfaces to version compatibly (capability-contract `compatibility_explicit` ×30) | Server and composition co-evolve; ○ hidden coupling |
| Rollback difficulty | n/a | New dirs only; git revert; layers untouched (facade-over-barrels) | Touches existing layer packages | ○ Publishes are forever (npm immutability) | Server removal strands SPA |
| Corpus discipline fit | — | ◑ Spec-first, dual-format, beads-ordered (matches waves 1-6 practice) | ○ Bypasses the project's own conformance gate | ○ Conflicts with single-surface governance | ◐ Defers interface stabilization |
| Human-testable scenarios exposed (workbench) | none | Pipeline, staleness (2-tab), disconnect-no-commit, keyboard-only, unsupported-visible | same, ungated | Consumer-dependent | Best staleness honesty, latest arrival |

**Reading:** S1 dominates on the criteria that the corpus itself treats as
invariants (gated semantics, spec-first, reversibility). S3 is the strongest
"what we're NOT considering" challenger — it is what a mature library ecosystem
would do — but it multiplies the compatibility-decision obligation 30× and has no
single surface for the workbench. S1 keeps S3 reachable later: once the shell is
the stable surface, per-layer publishing becomes an incremental option, not a
fork. **Matrix verdict: S1 stands, with S3 noted as the long-term path, not the
first move.**

---

## Part 2 — Edge Case Discovery (six-boundary, delta spec under review)

Specification: `openspec/changes/add-composition-shell/specs/composition-shell/spec.md`
Risk profile: concurrent (multi-consumer persistence) — see risk gate.
Boundaries applied: 1-6 (gate opened 5-6 on concurrency evidence).

### Boundary 1 — HUMAN (consumers: agent devs, SPA devs, maintainers)

- [HUM-001] MEDIUM — Misconfigured consumer: port declared with an empty/unknown
  dedup-scope label. Gap: spec rejects *missing* ports; nothing validates the
  *declared scope value*. Scenario: Given a port whose declared scope is empty or
  unrecognized, when the shell is constructed, then construction is rejected with a
  typed reason naming the undeclared scope.
- [HUM-002] MEDIUM — Maintainer upgrades the library mid-task: shell surface version
  and layer contract versions can move independently. Gap: decision results carry
  policy/catalog versions (`pinned_versions_in_result`) but no composed
  shell↔layer compatibility identity. Scenario: Given a committed decision, then
  the result identifies the shell surface version and the composed layer contract
  versions together.
- [HUM-003] LOW — Operator observability: workbench needs provenance retrieval
  (versions, candidates, exclusions, reason codes — engine already records it).
  Scenario: Given a committed decision, then provenance is retrievable through the
  shell surface without reaching into engine internals.

### Boundary 2 — BUSINESS (four-path example mapping)

Happy path: covered (`full-pipeline-via-the-shell`). Error path: covered
(un-normalized refusal, stale rejection, port failure). Gaps:

- [BIZ-001] HIGH — Abuse path: no-bypass guarantee is implicit. The spec never
  constrains `evaluateNeed`'s input type; a consumer could hand-build a normalized
  need and skip the need layer. Scenario: Given a raw unvalidated need object,
  when submitted through the shell's evaluation surface, then it is normalized or
  refused — no input shape reaches the engine without passing the need layer's
  validation.
- [BIZ-002] MEDIUM — Hazard/TOCTOU: policy/catalog rotated between evaluate and
  commit. Evaluation is pinned; commit-time identity is not restated. Scenario:
  Given the catalog rotates after evaluation, when the decision is committed, then
  the commit carries exactly the evaluated versions or is refused as stale.
- [BIZ-003] HIGH — Hazard: port commit fails mid-commit (quota, disk, transport).
  Model has no failure state between `decided` and `committed`; the new
  `port_failure_semantics_declared` governs behavior but the state machine never
  enters a failure state. Scenario: Given the declared port fails at the commit
  boundary, then committed state is unchanged, the shell remains in `decided` with
  a typed failure outcome, and no partial mutation is observable.
- [BIZ-004] HIGH — **Unresolved question / missing composition**: session
  suspension/resume mid-pipeline. Verified: 0 matches for suspend/resume/continuity
  in the delta, while `session-state` exports `resumeValidatesRevisions`,
  `continuityOf`, `pendingInteractionValid` and `continuity-contract` has a full
  barrel. The shell composes session-state but drops its continuity semantics.
  Scenario: Given a session suspends after evaluation but before commit, when the
  session resumes, then the shell validates stored revisions before committing and
  refuses to commit across an unvalidated resume.

### Boundary 3 — MATHEMATICAL (EP/BVA/decision tables)

- [MATH-001] MEDIUM — Empty result class: zero eligible candidates (empty catalog
  or total exclusions). Gap: projection of an empty decision undefined. Scenario:
  Given evaluation yields zero eligible candidates, then the projection is a typed
  empty outcome (not an error, not a null render).
- [MATH-002] LOW — Event ID uniqueness across ports: dedup semantics owned by the
  port's declared scope; boundary behavior at scope edges is runtime-owned. No
  shell gap.
- [MATH-003] LOW — Version string degenerate cases (empty, "0.0.0"): release-process
  concern (compatibility decision), not runtime. No shell gap.

### Boundary 4 — ARCHITECTURAL (design by contract)

- [ARCH-001] HIGH — **The persistence port interface is unspecified.** The central
  new contract of this capability is referenced four times but never enumerated: no
  operation set (commit / load / replay / scope declaration), no per-method
  pre/postconditions. Implementation cannot TDD against an undefined port.
  Suggested contract: `PersistencePort { scope: DedupScope; commit(entry): CommitResult;
  load(): CommittedState; replay(): ReplayLog }` with preconditions (entry validated)
  and postconditions (atomic or declared-weaker, per `commit_through_declared_port`).
- [ARCH-002] MEDIUM — Shell factory preconditions: policy/catalog machine state
  validity. Catalog barrel exports `publicationApproved`, `kindSetPinned` — an
  unpublished catalog version must not construct a working shell. Scenario: Given
  an unpublished catalog version, when the shell is constructed or evaluates, then
  a typed refusal names the unpublished version.
- [ARCH-003] LOW — Postcondition of evaluate on empty decision ties to MATH-001
  (decided vs projected). Resolve with MATH-001's scenario.

### RISK GATE

```
Risk Assessment: Safety/security [N], Concurrency [Y], Regulatory [N], Failure cost [M]
Boundary 5 (Failure): APPLY — multi-consumer persistence sharing is realistic (agents)
Boundary 6 (Formal): APPLY (lightweight) — concurrency confirmed; state-machine
  completeness already machine-checked by spk lint, so only liveness considered
```

### Boundary 5 — FAILURE (FMEA + STRIDE)

- [FAIL-001] HIGH — Failure mode: two shells (or two agents) sharing one persistence
  port submit concurrently. Risk: High/Possible/Hidden. Verified: 0 matches for
  concurrency in the delta. Runtime owns revision CAS (`event_commit_preconditions_satisfied`)
  but the shell spec never states the composed guarantee. Scenario: Given two
  concurrent submits against the same interaction revision through a shared port,
  then exactly one commits and the other receives a typed stale rejection.
- [FAIL-002] MEDIUM — STRIDE Spoofing/Tampering: consumer forges need provenance.
  `evidence-provenance` layer exists; the shell surface does not require carrying
  provenance through results. Scenario: Given a need with provenance evidence, then
  the shell result preserves the provenance record and a result without provenance
  evidence is distinguishable from one with it.
- [FAIL-003] MEDIUM — Failure mode: committed-state corruption (schema drift, partial
  write). Recovery-contract layer exists (barrel exports `createRecoveryMachine`,
  `RECOVERY_OPERATIONS`) but the shell's error surface doesn't reference recovery
  outcomes. Scenario: Given the port reports a corrupt or unreplayable state on
  load, then the shell surfaces a typed recovery outcome instead of throwing.

### Boundary 6 — FORMAL (lightweight)

- [FORM-001] LOW — Liveness: `retry_after_state_refresh` could cycle indefinitely if
  snapshots never arrive; acceptable (awaiting external input), matches runtime's
  identical shape. No new property needed.
- [FORM-002] LOW — State-machine completeness is enforced by spk lint
  (every_state_used / terminal_states_emit) on every revision — covered by existing
  gates.

### Synthesis

| Boundary | CRITICAL | HIGH | MEDIUM | LOW | Total |
|---|---|---|---|---|---|
| HUMAN | 0 | 0 | 2 | 1 | 3 |
| BUSINESS | 0 | 3 | 1 | 0 | 4 |
| MATHEMATICAL | 0 | 0 | 1 | 2 | 3 |
| ARCHITECTURAL | 0 | 1 | 1 | 1 | 3 |
| FAILURE | 0 | 1 | 2 | 0 | 3 |
| FORMAL | 0 | 0 | 0 | 2 | 2 |
| **TOTAL** | **0** | **5** | **7** | **6** | **18** |

**Top 5 gaps (all mechanically verified against the artifact/repo):**
1. [ARCH-001] Persistence port interface unspecified — the capability's central
   contract is implicit. Fix: enumerate port operations + per-method pre/postconditions
   in the delta and design.md before tasks 2.1.
2. [BIZ-004] Continuity/resume composition missing (0 grep hits; session-state
   exports exist unused). Fix: add suspend/resume states or an explicit
   delegation constraint to session-state/continuity-contract.
3. [BIZ-001] No-bypass guarantee implicit — input typing of the evaluation surface
   unconstrained. Fix: constraint that every evaluation input passes need-layer
   validation; no raw-context path.
4. [FAIL-001] Multi-consumer concurrency uncomposed. Fix: scenario + constraint
   inheriting runtime's CAS guarantee at shell level.
5. [BIZ-003] Commit-failure state undefined in the model. Fix: typed failure outcome
   from `decided`, no partial mutation scenario.

**Scenario catalog:** Happy 1/1 · Error 3/4 (commit-failure state missing) ·
Abuse 0/1 (bypass missing) · Hazard 1/3 (continuity, corruption missing).

**Missing contracts:** port operations (pre/postconditions); composite version
identity; recovery-outcome surfacing.

**Verdict: NEEDS_CONTRACTS** — the proposal's approach (S1) survives the matrix,
but the delta needs one more revision pass: port contract + continuity + no-bypass
+ concurrency + commit-failure scenario before approval and tasks 2.1.

---

## Addendum — Rule-of-5 Revision (2026-10-08)

Review verdict: NEEDS_REVISION. v1 above is preserved as the record; corrections
below supersede it. HIGH-1 TypeSafe-verified @ 0.99.

### Corrected structure: two orthogonal axes

Axis A — **Composition governance**: G1 spec'd shell capability (proposed) ·
G2 unregulated module · G3 none (per-package publishing, consumers compose).
Axis B — **Execution host**: H1 in-browser core (Option A) · H2 thin server
(Option B).

| | H1 in-browser (Option A) | H2 thin server (Option B) |
|---|---|---|
| **G1 spec'd shell** | **Intended path**: shell now (this change) → workbench SPA as first consumer; Option B server later reuses the same shell unchanged | **Planned evolution**, not a fork: server becomes another shell consumer; staleness/dedup tests become honest over transport |
| **G2 unregulated module** | Fast to code; ○ no scenario/contract gate on composition | ○ coupling hidden inside server |
| **G3 none / per-package** | ○ consumers compose from 30 packages; `compatibility_explicit` ×30 | ○ same, plus transport |

Facts that hold from v1: zero cross-layer imports today; `private: true` +
`noEmit` + vitest globals in src block distribution; conformance gate covers only
what a spec governs. The v1 single-dimension table's S-column set was not wrong
about facts, only about structure: S4 was the sole embodiment of H2, hiding the
G1+H2 cell the design.md migration plan already intends.

### Corrected cells (v1 errors)

- Rollback (G1): "new dirs **and build-config edits** (`package.json`/`tsconfig.json`
  per tasks 3.1–3.2); layers' semantic code untouched (facade-over-barrels)."
- Judgment leakage fixes: "Fast to code, ungated" → "no new spec; composition
  ungated by `ah check`" (fact). "Best staleness honesty, latest arrival" →
  "staleness/dedup exercised over real transport; SPA work deferred" (fact).
- Decision rule (explicit): **corpus-invariant criteria (conformance gating,
  spec-first discipline, reversibility) outrank speed-to-e2e; distribution is
  deferred, not sacrificed** — re-derivable: G1 is the only governance option
  the corpus's own gates can falsify, and both H1 and H2 remain reachable under
  G1, while G2/G3 foreclose gated composition entirely.

### Second-order criteria added from this document's own boundary findings

- Security posture: FAIL-002 (provenance carry-through) — criterion added; risk
  gate's Security [N] is revised to [M] (spoofing/tampering of need provenance by
  consumers; no privilege elevation in-library).
- Concurrency: FAIL-001 (multi-consumer shared port) — G1 must compose runtime's
  CAS guarantee; added as a required scenario (tracked: wanna-40i).
- Observability: HUM-003 (provenance retrieval) — workbench-relevant; tracked:
  wanna-40i.

### Superseded verdict

**Decision: G1 + H1 now (this change), G1 + H2 as the planned follow-up
(`add-workbench-spa` then server slice). G3 remains the long-term publishing
path once the G1 surface is stable.** Unchanged from v1's recommendation — but
now derivable from the table instead of asserted.
