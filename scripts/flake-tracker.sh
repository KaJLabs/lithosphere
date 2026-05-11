#!/usr/bin/env bash
#
# flake-tracker.sh — find tests that pass on some runs and fail on others.
#
# Usage:
#   scripts/flake-tracker.sh <results-dir>
#
# Each file in <results-dir> must be a vitest --reporter=json output (commonly
# downloaded from CI artifacts via `gh run download`). Tests whose fullName
# appears with BOTH passed and failed statuses across the dir are reported.
#
# This is intentionally minimal: no Slack/PR webhooks, no statistical models.
# It exists so flakes can be detected by anyone with shell + jq.

set -euo pipefail

DIR="${1:-}"
if [ -z "$DIR" ] || [ ! -d "$DIR" ]; then
  echo "usage: $0 <results-dir>" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 2
fi

shopt -s nullglob
FILES=("$DIR"/*.json)
if [ "${#FILES[@]}" -eq 0 ]; then
  echo "no JSON files found in $DIR" >&2
  exit 1
fi

echo "Scanning ${#FILES[@]} run(s) in $DIR..."

# Build a TSV of: status<TAB>full_name across all runs, then group by name.
flake_rows=$(
  for f in "${FILES[@]}"; do
    jq -r '
      .testResults // []
      | .[]
      | (.assertionResults // [])[]
      | "\(.status)\t\(.ancestorTitles + [.title] | join(" > "))"
    ' "$f"
  done
)

if [ -z "$flake_rows" ]; then
  echo "No test results parsed — JSON may not be in vitest --reporter=json format."
  exit 1
fi

flakes=$(
  echo "$flake_rows" \
    | awk -F'\t' '{ name=$2; status=$1; seen[name][status]=1 } END {
        for (n in seen) {
          if (("passed" in seen[n]) && ("failed" in seen[n])) print n
        }
      }' \
    | sort -u
)

if [ -z "$flakes" ]; then
  echo "✓ No flakes detected across ${#FILES[@]} runs."
  exit 0
fi

echo ""
echo "⚠ Flaky tests detected (passed in some runs, failed in others):"
echo "$flakes" | sed 's/^/  - /'
exit 0
