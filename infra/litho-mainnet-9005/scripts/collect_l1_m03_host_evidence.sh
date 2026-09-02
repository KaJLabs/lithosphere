#!/usr/bin/env bash
set -euo pipefail

# Read-only, secret-free host collector. Run as an authorized administrator on
# the Makalu validator and return only the generated directory.

SERVICE="${1:-lithod-mtest-val-02}"
RPC_URL="${2:-http://127.0.0.1:26757}"
OUTPUT="${3:-l1-m03-host-evidence-$(date -u +%Y%m%dT%H%M%SZ)}"
EXPECTED_SHA256="1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc"

umask 077
mkdir -- "$OUTPUT"

date -u +%FT%TZ > "$OUTPUT/collected-at.txt"
systemctl show "$SERVICE" \
  --property=Id,LoadState,ActiveState,SubState,MainPID,ExecMainStartTimestamp,FragmentPath,DropInPaths \
  > "$OUTPUT/systemd-status.txt"

main_pid="$(systemctl show "$SERVICE" --property=MainPID --value)"
test "$main_pid" -gt 0
resolved_binary="$(readlink -f "/proc/$main_pid/exe")"
printf '%s\n' "$resolved_binary" > "$OUTPUT/resolved-binary-path.txt"
sha256sum -- "$resolved_binary" > "$OUTPUT/running-binary.sha256"
grep -Fq "$EXPECTED_SHA256" "$OUTPUT/running-binary.sha256"

curl --fail --silent --show-error "$RPC_URL/status" > "$OUTPUT/comet-status.json"
curl --fail --silent --show-error "$RPC_URL/net_info" > "$OUTPUT/comet-net-info.json"
curl --fail --silent --show-error "$RPC_URL/validators" > "$OUTPUT/comet-validators.json"

journalctl --unit "$SERVICE" --since '2026-09-01 09:45:00 UTC' \
  --until '2026-09-01 11:15:00 UTC' --no-pager --output=short-iso \
  | grep -Ei 'started|stopped|block|commit|panic|fatal|double.?sign|consensus|error' \
  > "$OUTPUT/journal-window-filtered.txt" || true

dropin_dir="/etc/systemd/system/${SERVICE}.service.d"
if test -d "$dropin_dir"; then
  find "$dropin_dir" -maxdepth 1 -type f \
    \( -name '20-security-candidate.conf' -o -name '20-security-candidate.conf.rollback-*' \) \
    -exec sha256sum -- {} + > "$OUTPUT/service-dropins.sha256"
else
  : > "$OUTPUT/service-dropins.sha256"
fi

(
  cd "$OUTPUT"
  find . -maxdepth 1 -type f ! -name SHA256SUMS.txt -print0 \
    | sort -z | xargs -0 sha256sum > SHA256SUMS.txt
)

printf 'HOST_EVIDENCE=%s\n' "$OUTPUT"
printf 'RUNNING_BINARY_SHA256=%s\n' "$EXPECTED_SHA256"
