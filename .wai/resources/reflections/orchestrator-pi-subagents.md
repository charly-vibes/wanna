# Orchestrator pattern: pi subagents + wai pipeline (wave-1)

Established 2026-10-07 for the wanna wave-1 tickets (jmu/4mf/dhj/15r), copied
from specodelic's epic-orchestrator pattern (see
`../specodelic/.wai/resources/reflections/orchestrator-pi-subagents.md`).

**Non-negotiable spawn contract** (user-corrected 2026-10-07 — an ephemeral
`--no-session` spawn was aborted for exactly this):

- `pi -p -n "subagent:<ticket>:<steps>" "$(cat <brief-path>)"` from repo cwd
- **NEVER `--no-session`** — usage/cost records are lost
- Named sessions discoverable via
  `grep -l "subagent:<ticket>" ~/.pi/agent/sessions/<cwd-key>/*.jsonl`

## Loop

Lead orchestrates only: claim (`bd update <id> --claim`) → fill brief from
`.wai/resources/templates/subagent-brief.md` → commit orchestrator files so
the subagent starts clean → spawn → verify (`git log` vs report, `ah check
--run-tests`, `spk lint openspec`, pretender, eslint) → push → `bd close` +
`bd export` → `wai pipeline next`.

Pipeline: `.wai/resources/pipelines/wave-1.toml` (one step per ticket, one
ticket per advance — never chain).

## Repo-specific ratchets

- pretender: function_lines ≤40, cyclomatic ≤10 — split proactively (8zj
  needed makeMachine + needShapeValid/needProvenanceValid splits)
- negative tests assert PRECISE failure reasons (masked-violation lesson:
  roles_allowlisted bypass survived loose `/allowlist|role/i` patterns)
- testaruda pre-push needs `testaruda ingest <vitest.json>` + fingerprint
  after landing tests, else exit 10
- eslint gate is changed-files-scoped at commit; corpus has known noise
  (`CANDIDATE_ORDER` unused-var in tests/engine/properties-core.test.ts)