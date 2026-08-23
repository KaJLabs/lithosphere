#!/usr/bin/env bash
# =============================================================================
# build-lithod.sh — Build lithod from Evmos source with Lithosphere branding
# =============================================================================
# Must run on Linux x86_64 (WSL, Docker, or EC2 instance).
#
# Prerequisites: go (1.22+), make, gcc, git
#
# Usage:
#   bash bin/build-lithod.sh                          # default Evmos version
#   EVMOS_VERSION=v19.0.0 bash bin/build-lithod.sh    # override version
#
# Output: bin/lithod (Linux x86_64 ELF binary)
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via environment variables)
# ---------------------------------------------------------------------------
EVMOS_VERSION="${EVMOS_VERSION:-v20.0.0}"
EVMOS_COMMIT="${EVMOS_COMMIT:-eca13ef2521a9ef13c32e80b1b147230bdb155b5}"
COSMOS_SDK_VERSION="${COSMOS_SDK_VERSION:-v0.50.14}"
COSMOS_SDK_COMMIT="${COSMOS_SDK_COMMIT:-f2e6295b662fdb27ea33da1296c29588ccdaab42}"
COMETBFT_VERSION="${COMETBFT_VERSION:-v0.38.22}"
IBC_GO_VERSION="${IBC_GO_VERSION:-v8.7.0}"
COSMOS_MATH_VERSION="${COSMOS_MATH_VERSION:-v1.4.0}"
BUILD_DIR="${BUILD_DIR:-/tmp/litho-evmos-v20-security-build}"
SDK_BUILD_DIR="${SDK_BUILD_DIR:-/tmp/litho-cosmos-sdk-v0.50.14}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${OUTPUT:-${SCRIPT_DIR}/lithod}"
SKIP_SBOM=false

# Parse command-line flags
for arg in "$@"; do
    case "$arg" in
        --skip-sbom) SKIP_SBOM=true ;;
    esac
done

# Branding constants
BECH32_PREFIX="litho"
BINARY_NAME="lithod"
DENOM="ulitho"

echo "================================================================"
echo " Building lithod from Evmos ${EVMOS_VERSION}"
echo "================================================================"
echo "Build dir : ${BUILD_DIR}"
echo "Output    : ${OUTPUT}"
echo "Prefix    : ${BECH32_PREFIX}"
echo "Denom     : ${DENOM}"
echo "SDK       : ${COSMOS_SDK_VERSION} (${COSMOS_SDK_COMMIT})"
echo "CometBFT  : ${COMETBFT_VERSION}"
echo "IBC-Go    : ${IBC_GO_VERSION}"
echo "SDK Math  : ${COSMOS_MATH_VERSION}"
echo ""

# ---------------------------------------------------------------------------
# Prerequisites check
# ---------------------------------------------------------------------------
MISSING=""
for cmd in go make gcc git sed find; do
    if ! command -v "$cmd" &>/dev/null; then
        MISSING="${MISSING} $cmd"
    fi
done
if [ -n "$MISSING" ]; then
    echo "ERROR: Missing required tools:${MISSING}"
    echo "Install them first (e.g., sudo apt install golang-go make gcc git)"
    exit 1
fi

GO_VER=$(go version)
echo "Go: ${GO_VER}"
echo ""

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
    if [ -d "${BUILD_DIR}" ]; then
        echo "Cleaning up ${BUILD_DIR} ..."
        rm -rf "${BUILD_DIR}"
    fi
    if [ -d "${SDK_BUILD_DIR}" ]; then
        echo "Cleaning up ${SDK_BUILD_DIR} ..."
        rm -rf "${SDK_BUILD_DIR}"
    fi
}
trap cleanup EXIT

if [[ -e "${BUILD_DIR}" || -e "${SDK_BUILD_DIR}" ]]; then
    echo "ERROR: build paths must not already exist: ${BUILD_DIR}, ${SDK_BUILD_DIR}" >&2
    echo "Remove only these stale task-specific directories after verifying their paths." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Clone Evmos at pinned version
# ---------------------------------------------------------------------------
echo ">>> Cloning evmos/evmos @ ${EVMOS_VERSION} ..."
git clone --depth 1 --branch "${EVMOS_VERSION}" \
    https://github.com/evmos/evmos.git "${BUILD_DIR}"
cd "${BUILD_DIR}"
ACTUAL_EVMOS_COMMIT="$(git rev-parse HEAD)"
if [[ "${ACTUAL_EVMOS_COMMIT}" != "${EVMOS_COMMIT}" ]]; then
    echo "ERROR: Evmos source mismatch: expected ${EVMOS_COMMIT}, got ${ACTUAL_EVMOS_COMMIT}" >&2
    exit 1
fi
echo ""

# Rebase Evmos's small Cosmos-SDK compatibility delta onto the patched SDK
# release. A local replace is intentional: the upstream Evmos SDK fork ended at
# v0.50.9 and therefore does not contain the later consensus security fixes.
echo ">>> Cloning patched Cosmos SDK ${COSMOS_SDK_VERSION} ..."
git clone --depth 1 --branch "${COSMOS_SDK_VERSION}" \
    https://github.com/cosmos/cosmos-sdk.git "${SDK_BUILD_DIR}"
ACTUAL_SDK_COMMIT="$(git -C "${SDK_BUILD_DIR}" rev-parse HEAD)"
if [[ "${ACTUAL_SDK_COMMIT}" != "${COSMOS_SDK_COMMIT}" ]]; then
    echo "ERROR: Cosmos SDK source mismatch: expected ${COSMOS_SDK_COMMIT}, got ${ACTUAL_SDK_COMMIT}" >&2
    exit 1
fi

SDK_COMPAT_PATCH="${SCRIPT_DIR}/patches/cosmos-sdk-v0.50.14-evmos-compat.patch"
git -C "${SDK_BUILD_DIR}" apply --check "${SDK_COMPAT_PATCH}"
git -C "${SDK_BUILD_DIR}" apply "${SDK_COMPAT_PATCH}"

echo ">>> Pinning patched consensus dependencies ..."
go mod edit -require="cosmossdk.io/math@${COSMOS_MATH_VERSION}"
go mod edit -require="github.com/cometbft/cometbft@${COMETBFT_VERSION}"
go mod edit -require="github.com/cosmos/cosmos-sdk@${COSMOS_SDK_VERSION}"
go mod edit -require="github.com/cosmos/ibc-go/v8@${IBC_GO_VERSION}"
go mod edit -replace="github.com/cosmos/cosmos-sdk=${SDK_BUILD_DIR}"
go mod tidy
go mod verify

test "$(go list -m -f '{{.Version}}' cosmossdk.io/math)" = "${COSMOS_MATH_VERSION}"
test "$(go list -m -f '{{.Version}}' github.com/cometbft/cometbft)" = "${COMETBFT_VERSION}"
test "$(go list -m -f '{{.Version}}' github.com/cosmos/ibc-go/v8)" = "${IBC_GO_VERSION}"
test "$(go list -m -f '{{with .Replace}}{{.Dir}}{{end}}' github.com/cosmos/cosmos-sdk)" = "${SDK_BUILD_DIR}"
echo ""

# Enforce LITHO's permanent fixed supply before applying branding changes.
SUPPLY_PATCH="${SCRIPT_DIR}/patches/evmos-v20-litho-fixed-supply.patch"
echo ">>> Applying permanent LITHO supply-cap patch ..."
git apply --check "${SUPPLY_PATCH}"
git apply "${SUPPLY_PATCH}"

# Evmos integration tests use a deliberately small synthetic genesis. Normalize
# that fixture to the immutable LITHO cap without weakening the production gate.
INTEGRATION_TEST_PATCH="${SCRIPT_DIR}/patches/evmos-v20-litho-integration-tests.patch"
git apply --check "${INTEGRATION_TEST_PATCH}"
git apply "${INTEGRATION_TEST_PATCH}"

echo ">>> Testing genesis cap, transaction cap, and permanent inflation disable ..."
go test ./app/post -run TestSupplyCapDecorator -count=1
go test ./x/inflation/v1/types -run TestLITHOInflationPermanentlyDisabled -count=1
go test ./app -run TestValidateLITHOGenesisSupply -count=1
go test ./x/erc20/keeper ./x/ibc/transfer/keeper -count=1
echo ""

# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 2. Rebrand bech32 prefix  (evmos → litho)
# ---------------------------------------------------------------------------
echo ">>> Rebranding bech32 prefix: evmos → ${BECH32_PREFIX}"

# Primary constant — covers all derived prefixes (lithovaloper, lithovalcons, etc.)
find . -name "*.go" -not -path "./vendor/*" -print0 \
  | xargs -0 grep -l 'AccountAddressPrefix\|Bech32Prefix' 2>/dev/null \
  | while read -r f; do
        sed -i \
            -e 's/AccountAddressPrefix\s*=\s*"evmos"/AccountAddressPrefix = "litho"/g' \
            -e 's/Bech32Prefix\s*=\s*"evmos"/Bech32Prefix = "litho"/g' \
            "$f"
        echo "   patched: $f"
    done

# Default home directory (.evmosd → .lithod)
find . -name "*.go" -not -path "./vendor/*" -print0 \
  | xargs -0 grep -l '\.evmosd\|"evmosd"' 2>/dev/null \
  | while read -r f; do
        sed -i \
            -e 's/\.evmosd/.lithod/g' \
            -e 's/"evmosd"/"lithod"/g' \
            "$f"
        echo "   patched: $f"
    done
echo ""

# ---------------------------------------------------------------------------
# 3. Rebrand default denom  (aevmos → ulitho)
# ---------------------------------------------------------------------------
echo ">>> Rebranding denom: aevmos → ${DENOM}"

find . -name "*.go" -not -path "./vendor/*" -print0 \
  | xargs -0 grep -l '"aevmos"' 2>/dev/null \
  | while read -r f; do
        sed -i 's/"aevmos"/"ulitho"/g' "$f"
        echo "   patched: $f"
    done
echo ""

# ---------------------------------------------------------------------------
# 4. Rebrand display denom  (evmos → LITHO where appropriate)
# ---------------------------------------------------------------------------
echo ">>> Rebranding display references"

# Display denom strings (used in metadata / CLI help)
find . -name "*.go" -not -path "./vendor/*" -print0 \
  | xargs -0 grep -l '"EVMOS"\|"Evmos"' 2>/dev/null \
  | while read -r f; do
        sed -i \
            -e 's/"EVMOS"/"LITHO"/g' \
            -e 's/"Evmos"/"Lithosphere"/g' \
            "$f"
        echo "   patched: $f"
    done
echo ""

# ---------------------------------------------------------------------------
# 5. Update Makefile binary name
# ---------------------------------------------------------------------------
echo ">>> Updating Makefile binary name"

if [ -f Makefile ]; then
    # Handle various Makefile patterns for the binary name
    sed -i \
        -e 's/BINARY_NAME\s*[?:]*=\s*evmosd/BINARY_NAME ?= lithod/g' \
        -e 's/BUILDDIR ?= $(CURDIR)\/build/BUILDDIR ?= $(CURDIR)\/build/g' \
        Makefile
    echo "   patched: Makefile"
fi
echo ""

# ---------------------------------------------------------------------------
# 6. Build
# ---------------------------------------------------------------------------
echo ">>> Building (this may take several minutes) ..."
echo ""

make build 2>&1 | tail -30

echo ""

# ---------------------------------------------------------------------------
# 7. Locate and copy binary
# ---------------------------------------------------------------------------
BUILT=""
for candidate in \
    "build/${BINARY_NAME}" \
    "build/evmosd" \
    "out/${BINARY_NAME}" \
    "out/evmosd" \
    "${GOPATH:-$HOME/go}/bin/evmosd" \
    "${GOPATH:-$HOME/go}/bin/${BINARY_NAME}"; do
    if [ -f "$candidate" ]; then
        BUILT="$candidate"
        break
    fi
done

if [ -z "$BUILT" ]; then
    echo "ERROR: Could not find built binary."
    echo "Contents of build/:"
    ls -la build/ 2>/dev/null || echo "  (no build/ directory)"
    echo "Contents of out/:"
    ls -la out/ 2>/dev/null || echo "  (no out/ directory)"
    exit 1
fi

echo ">>> Found binary: ${BUILT}"
cp "$BUILT" "${OUTPUT}"
chmod +x "${OUTPUT}"

echo ""
echo "================================================================"
echo " BUILD COMPLETE"
echo "================================================================"
echo "Binary : ${OUTPUT}"
echo "Size   : $(du -h "${OUTPUT}" | cut -f1)"
echo ""

# Quick sanity check
if "${OUTPUT}" version 2>/dev/null; then
    echo "Version: $("${OUTPUT}" version 2>&1)"
else
    echo "(Binary built but cannot execute here — expected if not on Linux x86_64)"
fi

# Print SHA256 hash of the built binary
BUILT_SHA256="$(sha256sum "${OUTPUT}" | awk '{print $1}')"
echo "SHA256 : ${BUILT_SHA256}"
echo ""

echo ">>> Verifying security dependency evidence embedded in the binary ..."
"${SCRIPT_DIR}/verify-lithod-security-dependencies.sh" "${OUTPUT}" "${SDK_BUILD_DIR}"

echo ">>> Writing immutable build evidence ..."
sha256sum "${OUTPUT}" > "${OUTPUT}.sha256"
go version -m "${OUTPUT}" > "${OUTPUT}.modules.txt"
sha256sum \
    "${SDK_COMPAT_PATCH}" \
    "${SUPPLY_PATCH}" \
    "${INTEGRATION_TEST_PATCH}" > "${OUTPUT}.patches.sha256"
echo "Evidence: ${OUTPUT}.sha256"
echo "Evidence: ${OUTPUT}.modules.txt"
echo "Evidence: ${OUTPUT}.patches.sha256"

# ---------------------------------------------------------------------------
# 8. SBOM Generation (auto-call unless --skip-sbom)
# ---------------------------------------------------------------------------
if [[ "${SKIP_SBOM}" == "true" ]]; then
    echo ">>> SBOM generation skipped (--skip-sbom)"
else
    echo ">>> Generating SBOM artifacts ..."
    SBOM_SCRIPT="${SCRIPT_DIR}/generate-sbom.sh"
    if [[ -f "${SBOM_SCRIPT}" ]]; then
        bash "${SBOM_SCRIPT}" \
            --binary "${OUTPUT}" \
            --output-dir "${SCRIPT_DIR}/sbom" \
            --evmos-version "${EVMOS_VERSION}" || {
            echo "WARNING: SBOM generation failed (non-fatal)"
            echo "Run manually: bash bin/generate-sbom.sh"
        }
    else
        echo "WARNING: generate-sbom.sh not found at ${SBOM_SCRIPT}"
        echo "SBOM generation skipped"
    fi
fi

echo ""
echo "Next steps:"
echo "  1. Verify:  ./bin/lithod version"
echo "  2. Genesis: bash scripts/generate_lithosphere_genesis.sh"
echo "  3. Deploy:  ansible-playbook -i inventory/hosts playbooks/site.yml --tags binary,genesis"
if [[ "${SKIP_SBOM}" == "false" ]]; then
    echo "  4. Sign:    bash bin/sign-release.sh"
    echo "  5. Publish: bash bin/publish-release.sh --version <ver>"
fi
