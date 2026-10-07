#!/usr/bin/env bash
# readme-documents-pipeline — gate: README documents the pipeline and gates (EXCL-001/wanna-9nc).
set -euo pipefail
README="README.md"
[ -s "$README" ] || { echo "README.md missing or empty" >&2; exit 1; }
grep -qi 'specodelic' "$README" || { echo "README does not mention specodelic" >&2; exit 1; }
grep -qi 'lefthook' "$README" || { echo "README does not document lefthook gates" >&2; exit 1; }
grep -qi 'ah check' "$README" || { echo "README does not document 'ah check' verification" >&2; exit 1; }
