#!/usr/bin/env bash
# no-template-scenarios — gate: boilerplate template scenarios replaced with domain-behavior
# scenarios (DRAFT-001/wanna-bvp).
set -euo pipefail
HITS=$(grep -rln 'Template scenario' .espectacular/ 2>/dev/null || true)
if [ -n "$HITS" ]; then
    echo "Boilerplate 'Template scenario' still present in:" >&2
    echo "$HITS" | head -10 >&2
    exit 1
fi
