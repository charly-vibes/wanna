#!/usr/bin/env bash
# no-article-defect — gate: no 'violating-a-<vowel>' article defect in deployed contracts.
set -euo pipefail
HITS=$(grep -rn 'violating-a-' .espectacular/ 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "Article defect still present in .espectacular (CLAR-001/wanna-fhl):" >&2
    echo "$HITS" | head -10 >&2
    exit 1
fi
