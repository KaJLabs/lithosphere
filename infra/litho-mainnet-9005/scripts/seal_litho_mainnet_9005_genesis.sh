#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LITHOD="${LITHOD:-/usr/local/bin/lithod-mainnet-9005}"
OUTPUT="${OUTPUT:-${REPO_ROOT}/docs/workstreams/litho-mainnet-9005/genesis.json}"
GENERATOR="${REPO_ROOT}/scripts/generate_litho_mainnet_9005_genesis.py"
GENESIS_TIME="${GENESIS_TIME:-}"
EXPECTED_BINARY_SHA256="0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c"
CONSENSUS_PUBKEY="7o+6DXvzUZditxqvBH8RHScpB7KrAGrB4CvIHwByBSc="

if [ -z "${GENESIS_TIME}" ]; then
  echo "ERROR: set GENESIS_TIME to the approved UTC launch time (YYYY-MM-DDTHH:MM:SSZ)" >&2
  exit 1
fi

if ! [[ "${GENESIS_TIME}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
  echo "ERROR: GENESIS_TIME must use YYYY-MM-DDTHH:MM:SSZ" >&2
  exit 1
fi

if [ -e "${OUTPUT}" ] || [ -e "${OUTPUT}.sha256" ]; then
  echo "ERROR: final genesis or checksum already exists; refusing to overwrite" >&2
  exit 1
fi

if [ ! -x "${LITHOD}" ]; then
  echo "ERROR: fixed-supply binary is missing or not executable: ${LITHOD}" >&2
  exit 1
fi

binary_sha256=$(sha256sum "${LITHOD}" | awk '{print $1}')
if [ "${binary_sha256}" != "${EXPECTED_BINARY_SHA256}" ]; then
  echo "ERROR: fixed-supply binary checksum mismatch" >&2
  exit 1
fi

python3 "${GENERATOR}" \
  --binary "${LITHOD}" \
  --output "${OUTPUT}" \
  --consensus-pubkey "${CONSENSUS_PUBKEY}" \
  --genesis-time "${GENESIS_TIME}"

validate_home=$(mktemp -d /tmp/litho-mainnet-final-genesis.XXXXXX)
cleanup() {
  rm -rf -- "${validate_home}"
}
trap cleanup EXIT

mkdir -p "${validate_home}/config"
cp "${OUTPUT}" "${validate_home}/config/genesis.json"
"${LITHOD}" validate-genesis --home "${validate_home}"

python3 - "${OUTPUT}" "${GENESIS_TIME}" <<'PY'
import json
import sys

path, expected_time = sys.argv[1:]
with open(path, encoding="utf-8") as genesis_file:
    genesis = json.load(genesis_file)

assert genesis["chain_id"] == "lithosphere_9005-1"
assert genesis["genesis_time"] == expected_time
assert genesis["app_state"]["bank"]["supply"] == [{
    "denom": "ulitho",
    "amount": "1000000000000000000000000000",
}]
assert genesis["app_state"]["inflation"]["params"]["enable_inflation"] is False
assert genesis["app_state"]["staking"]["validators"][0]["tokens"] == "1000000000000000000"
assert genesis["app_state"]["gov"]["constitution"] == ""
assert "metadata" not in genesis
PY

genesis_sha256=$(sha256sum "${OUTPUT}" | awk '{print $1}')
printf '%s  %s\n' "${genesis_sha256}" "$(basename "${OUTPUT}")" > "${OUTPUT}.sha256"

echo "FINAL_GENESIS=${OUTPUT}"
echo "FINAL_GENESIS_SHA256=${genesis_sha256}"
echo "CUSTOM_HEIGHT_1_MESSAGE=NOT_PART_OF_GENESIS_REQUEST_AT_LAUNCH"
