#!/usr/bin/env bash
set -euo pipefail

BINARY="${1:-}"
EXPECTED_SDK_REPLACE="${2:-/tmp/litho-cosmos-sdk-v0.50.14}"

if [[ -z "${BINARY}" || ! -x "${BINARY}" ]]; then
    echo "usage: $0 /path/to/lithod [/expected/cosmos-sdk/replace]" >&2
    exit 2
fi

if ! command -v go >/dev/null 2>&1; then
    echo "ERROR: go is required to inspect embedded module metadata" >&2
    exit 2
fi

MODULES="$(go version -m "${BINARY}")"

require_version() {
    local module="$1"
    local expected="$2"
    local actual
    actual="$(awk -v module="${module}" '$1 == "dep" && $2 == module { print $3; exit }' <<<"${MODULES}")"
    if [[ "${actual}" != "${expected}" ]]; then
        echo "ERROR: ${module}: expected ${expected}, got ${actual:-missing}" >&2
        exit 1
    fi
    echo "PASS: ${module} ${actual}"
}

require_version "cosmossdk.io/math" "v1.4.0"
require_version "github.com/cometbft/cometbft" "v0.38.22"
require_version "github.com/cosmos/cosmos-sdk" "v0.50.14"
require_version "github.com/cosmos/ibc-go/v8" "v8.7.0"

if ! grep -Fq "${EXPECTED_SDK_REPLACE}" <<<"${MODULES}"; then
    echo "ERROR: patched Evmos-compatible Cosmos SDK replacement is not embedded" >&2
    exit 1
fi

echo "PASS: LITHO L1 security dependency gate"
