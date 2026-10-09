---
tags: [subagent:wanna-8k6, orchestrator:autonomous-2026-10-10]
---

8K6-COMMIT: session=subagent:wanna-8k6:commit-transactions — RED→GREEN 7 tests (741 total)

- domain.ts replay events + defensive fold; session.ts one-compare-and-commit-per-command
- consumer guard option (b): coreBehaviorLanded flips happy-path suites live; reconcile/cancel probes stay for gcp
- orchestrator tidied pretender violations (session split into ctx+command fns, isShellReplayEvent split, commit.test split, consumer fakes/support split)
- gates all green; ah overlay 378, 8 no-toml remain (gcp-owned)
