#!/usr/bin/env bash
# Refresh the pinned node:20-alpine digest across all three production
# Dockerfiles. Run this when the upstream image is rebuilt (security
# patches, npm bump, etc.) — typically every few weeks.
#
# Usage:
#   bash scripts/refresh-base-image-digest.sh
#
# Pinning rationale:
#   - Reproducibility: months from now, the same git SHA produces a
#     bit-identical image regardless of which "20-alpine" tag means today.
#   - SLSA discipline: the build provenance attestation references an
#     immutable digest, so a verifier can confirm no tag was hijacked.
#   - Trivy alignment: scans run against the same exact base layer every
#     time, so HIGH-CVE counts are comparable across CI runs.
#
# Bump cadence: when Trivy starts flagging new CVEs in the apk layer that
# upstream has already fixed in a newer 20-alpine push. The CVE delta
# usually means upstream pushed a patched alpine base; this script picks
# up that newer digest.

set -euo pipefail

REGISTRY="https://hub.docker.com/v2/repositories/library/node/tags/20-alpine"
NEW_DIGEST="$(curl -fsSL "$REGISTRY" | python -c "import sys,json; print(json.load(sys.stdin)['digest'])")"

if [[ -z "$NEW_DIGEST" ]] || [[ ! "$NEW_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "Failed to fetch a sha256 digest from Docker Hub. Got: $NEW_DIGEST" >&2
  exit 1
fi

echo "[refresh-digest] Upstream node:20-alpine current digest: $NEW_DIGEST"

# Find every FROM line referencing node:20-alpine in any form (pinned or
# unpinned) and rewrite it to the new digest. Touching every Dockerfile
# in one pass keeps the three services in lockstep.
mapfile -t TARGETS < <(grep -rlE "^FROM node:20-alpine(@sha256:[a-f0-9]+)? AS" Makalu/*/Dockerfile)

for f in "${TARGETS[@]}"; do
  echo "[refresh-digest] Rewriting $f"
  sed -i -E "s|^FROM node:20-alpine(@sha256:[a-f0-9]+)? AS|FROM node:20-alpine@$NEW_DIGEST AS|g" "$f"
done

echo "[refresh-digest] Done. Review the diff and commit if it changed:"
echo "  git diff -- Makalu/*/Dockerfile"
