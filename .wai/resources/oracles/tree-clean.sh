#!/usr/bin/env bash
# tree-clean — gate: no untracked noise except intentionally tracked session artifacts
# (.whisper/ is tracked with .whisper/private/ excluded; .pretender/history/ is ignored).
set -euo pipefail
NOISE=$(git status --porcelain | grep -E '^\?\? (\.whisper/|\.pretender/history/|\.whisper/private/)' || true)
if [ -n "$NOISE" ]; then
    echo "Untracked noise still present (add to .gitignore):" >&2
    echo "$NOISE" >&2
    exit 1
fi
