#!/usr/bin/env bash
# =============================================================================
# build-lithod.sh — Build lithod from Evmos source with Lithosphere branding
# =============================================================================
# Must run on Linux x86_64 (WSL, Docker, or EC2 instance).
#
# Prerequisites: go (1.22+), make, gcc, git
#
# Usage:
#   bash bin/build-lithod.sh
#
# Release source and dependency pins are immutable. Security-pin environment
# overrides and optional SBOM generation are deliberately rejected.
#
# Output: bin/lithod (Linux x86_64 ELF binary)
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Immutable release identity
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${OUTPUT:-${SCRIPT_DIR}/lithod}"
EVIDENCE_DIR="${EVIDENCE_DIR:-${OUTPUT}.evidence}"
RELEASE_MANIFEST="${SCRIPT_DIR}/lithod-release-manifest.sh"

if [[ $# -ne 0 ]]; then
    echo "ERROR: release build accepts no command-line overrides" >&2
    exit 2
fi

SECURITY_PINS=(
    EVMOS_VERSION EVMOS_COMMIT COSMOS_SDK_VERSION COSMOS_SDK_COMMIT
    COMETBFT_VERSION IBC_GO_VERSION COSMOS_MATH_VERSION GO_VERSION
    BUILD_DIR SDK_BUILD_DIR
)
for pin in "${SECURITY_PINS[@]}"; do
    if [[ -v "${pin}" ]]; then
        echo "ERROR: release security pin may not be supplied through the environment: ${pin}" >&2
        exit 2
    fi
done

BUILD_DIR="/tmp/litho-evmos-v20-security-build"
SDK_BUILD_DIR="/tmp/litho-cosmos-sdk-v0.50.14"

if [[ ! -f "${RELEASE_MANIFEST}" ]]; then
    echo "ERROR: immutable release manifest is missing: ${RELEASE_MANIFEST}" >&2
    exit 1
fi
# shellcheck source=lithod-release-manifest.sh
source "${RELEASE_MANIFEST}"

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
for cmd in go gofmt make gcc git sed find grep xargs awk sort sha256sum cp cmp curl tar tee date head uname; do
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
if [[ "$(go env GOVERSION)" != "${GO_VERSION}" ]]; then
    echo "ERROR: release Go version mismatch: expected ${GO_VERSION}, got $(go env GOVERSION)" >&2
    exit 1
fi
echo "Go: ${GO_VER}"
echo ""

if [[ -e "${OUTPUT}" || -e "${EVIDENCE_DIR}" ]]; then
    echo "ERROR: release output paths must not already exist: ${OUTPUT}, ${EVIDENCE_DIR}" >&2
    exit 1
fi
mkdir -p "$(dirname "${OUTPUT}")" "${EVIDENCE_DIR}"

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
SUPPLY_PATCH="${SCRIPT_DIR}/patches/evmos-v20-litho-fixed-supply.patch"
INTEGRATION_TEST_PATCH="${SCRIPT_DIR}/patches/evmos-v20-litho-integration-tests.patch"
LITHO_TEST_FIXTURES_PATCH="${SCRIPT_DIR}/patches/evmos-v20-litho-test-fixtures.patch"
STATEDB_GUARD_PATCH="${SCRIPT_DIR}/patches/evmos-v20-statedb-module-account-guard.patch"
STATEDB_PRECOMPILE_REGRESSION_PATCH="${SCRIPT_DIR}/patches/evmos-v20-statedb-precompile-regression.patch"

verify_patch() {
    local path="$1"
    local expected="$2"
    if [[ ! -f "${path}" ]]; then
        echo "ERROR: release patch is missing: ${path}" >&2
        exit 1
    fi
    echo "${expected}  ${path}" | sha256sum --check --strict
}

echo ">>> Verifying immutable patch identities ..."
verify_patch "${SDK_COMPAT_PATCH}" "${SDK_COMPAT_PATCH_SHA256}"
verify_patch "${SUPPLY_PATCH}" "${SUPPLY_PATCH_SHA256}"
verify_patch "${INTEGRATION_TEST_PATCH}" "${INTEGRATION_TEST_PATCH_SHA256}"
verify_patch "${LITHO_TEST_FIXTURES_PATCH}" "${LITHO_TEST_FIXTURES_PATCH_SHA256}"
verify_patch "${STATEDB_GUARD_PATCH}" "${STATEDB_GUARD_PATCH_SHA256}"
verify_patch "${STATEDB_PRECOMPILE_REGRESSION_PATCH}" "${STATEDB_PRECOMPILE_REGRESSION_PATCH_SHA256}"

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
echo ">>> Applying permanent LITHO supply-cap patch ..."
git apply --check "${SUPPLY_PATCH}"
git apply "${SUPPLY_PATCH}"

# Evmos integration tests use a deliberately small synthetic genesis. Normalize
# that fixture to the immutable LITHO cap without weakening the production gate.
git apply --check "${INTEGRATION_TEST_PATCH}"
git apply "${INTEGRATION_TEST_PATCH}"

echo ">>> Applying deterministic LITHO test-fixture conversion ..."
git apply --check "${LITHO_TEST_FIXTURES_PATCH}"
git apply "${LITHO_TEST_FIXTURES_PATCH}"

echo ">>> Applying Cosmos EVM v0.7.2 module-account StateDB guard backport ..."
git apply --check "${STATEDB_GUARD_PATCH}"
git apply "${STATEDB_GUARD_PATCH}"

echo ">>> Applying StateDB/precompile transaction regression backport ..."
git apply --check "${STATEDB_PRECOMPILE_REGRESSION_PATCH}"
git apply "${STATEDB_PRECOMPILE_REGRESSION_PATCH}"

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
# 6. Freeze and test the exact final source tree
# ---------------------------------------------------------------------------
echo ">>> Formatting and freezing the final source tree ..."
EXPECTED_NEW_SOURCE_FILES=(
    "app/litho_supply.go"
    "app/litho_supply_test.go"
    "app/post/supply_cap.go"
    "app/post/supply_cap_test.go"
    "x/inflation/v1/types/litho_params_test.go"
)
mapfile -t ACTUAL_NEW_SOURCE_FILES < <(git ls-files --others --exclude-standard | sort)
if [[ "$(printf '%s\n' "${ACTUAL_NEW_SOURCE_FILES[@]}")" != "$(printf '%s\n' "${EXPECTED_NEW_SOURCE_FILES[@]}" | sort)" ]]; then
    echo "ERROR: patched tree contains an unexpected set of new source files" >&2
    printf 'Expected:\n%s\nActual:\n%s\n' \
        "$(printf '%s\n' "${EXPECTED_NEW_SOURCE_FILES[@]}" | sort)" \
        "$(printf '%s\n' "${ACTUAL_NEW_SOURCE_FILES[@]}")" >&2
    exit 1
fi
git add --intent-to-add -- "${ACTUAL_NEW_SOURCE_FILES[@]}"

mapfile -d '' CHANGED_GO_FILES < <(git diff --name-only --diff-filter=ACMR -z -- '*.go')
if [[ ${#CHANGED_GO_FILES[@]} -eq 0 ]]; then
    echo "ERROR: release patches produced no changed Go source" >&2
    exit 1
fi
gofmt -w "${CHANGED_GO_FILES[@]}"

git diff --check
git -C "${SDK_BUILD_DIR}" diff --check

FINAL_EVMOS_DIFF="${EVIDENCE_DIR}/evmos-final-source.diff"
FINAL_SDK_DIFF="${EVIDENCE_DIR}/cosmos-sdk-final-source.diff"
git diff --binary --full-index HEAD > "${FINAL_EVMOS_DIFF}"
git -C "${SDK_BUILD_DIR}" diff --binary --full-index HEAD > "${FINAL_SDK_DIFF}"
cp go.mod "${EVIDENCE_DIR}/go.mod"
cp go.sum "${EVIDENCE_DIR}/go.sum"
go list -m -json all > "${EVIDENCE_DIR}/modules.json"
git status --porcelain=v1 --untracked-files=no > "${EVIDENCE_DIR}/evmos-final-status.txt"
git -C "${SDK_BUILD_DIR}" status --porcelain=v1 --untracked-files=no > "${EVIDENCE_DIR}/cosmos-sdk-final-status.txt"

FROZEN_EVMOS_DIFF_SHA256="$(sha256sum "${FINAL_EVMOS_DIFF}" | awk '{print $1}')"
FROZEN_SDK_DIFF_SHA256="$(sha256sum "${FINAL_SDK_DIFF}" | awk '{print $1}')"

verify_frozen_source() {
    local current_evmos
    local current_sdk
    current_evmos="$(git diff --binary --full-index HEAD | sha256sum | awk '{print $1}')"
    current_sdk="$(git -C "${SDK_BUILD_DIR}" diff --binary --full-index HEAD | sha256sum | awk '{print $1}')"
    if [[ "${current_evmos}" != "${FROZEN_EVMOS_DIFF_SHA256}" ]]; then
        echo "ERROR: Evmos final source changed after the release freeze" >&2
        exit 1
    fi
    if [[ "${current_sdk}" != "${FROZEN_SDK_DIFF_SHA256}" ]]; then
        echo "ERROR: Cosmos SDK final source changed after the release freeze" >&2
        exit 1
    fi
}

echo ">>> Testing the exact frozen final tree ..."
go test ./app/post -run TestSupplyCapDecorator -count=1 | tee "${EVIDENCE_DIR}/test-supply-cap.log"
go test ./x/inflation/v1/types -run TestLITHOInflationPermanentlyDisabled -count=1 | tee "${EVIDENCE_DIR}/test-inflation-disabled.log"
go test ./app -run TestValidateLITHOGenesisSupply -count=1 | tee "${EVIDENCE_DIR}/test-genesis-supply.log"
go test ./x/erc20/keeper ./x/ibc/transfer/keeper -count=1 | tee "${EVIDENCE_DIR}/test-erc20-ibc.log"
go test ./x/evm/keeper -run 'TestKeeperTestSuite/TestSetBalance' -count=1 | tee "${EVIDENCE_DIR}/test-statedb-keeper.log"
go test ./precompiles/staking \
    -run '^TestPrecompileIntegrationTestSuite$' \
    -ginkgo.focus 'should reject internal transfers to the bonded tokens pool across precompile orderings' \
    -count=1 | tee "${EVIDENCE_DIR}/test-statedb-precompile-integration.log"
verify_frozen_source
echo ""

# ---------------------------------------------------------------------------
# 7. Build
# ---------------------------------------------------------------------------
echo ">>> Building (this may take several minutes) ..."
echo ""

make build 2>&1 | tail -30

verify_frozen_source

echo ""

# ---------------------------------------------------------------------------
# 8. Locate and copy binary
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

echo ">>> Generating mandatory CycloneDX SBOM ..."
SBOM_SCRIPT="${SCRIPT_DIR}/generate-sbom.sh"
if [[ ! -f "${SBOM_SCRIPT}" ]]; then
    echo "ERROR: mandatory SBOM generator is missing: ${SBOM_SCRIPT}" >&2
    exit 1
fi
bash "${SBOM_SCRIPT}" \
    --binary "${OUTPUT}" \
    --output-dir "${EVIDENCE_DIR}" \
    --release-version "${RELEASE_ID}" \
    --tool-version "${CYCLONEDX_GOMOD_VERSION}" \
    --tool-sha256 "${CYCLONEDX_GOMOD_LINUX_AMD64_SHA256}"

echo ">>> Writing immutable release evidence ..."
cp "${OUTPUT}" "${EVIDENCE_DIR}/lithod"
chmod 0755 "${EVIDENCE_DIR}/lithod"
cp "${RELEASE_MANIFEST}" "${EVIDENCE_DIR}/lithod-release-manifest.sh"
go version -m "${OUTPUT}" > "${EVIDENCE_DIR}/lithod.modules.txt"
sha256sum \
    "${SDK_COMPAT_PATCH}" \
    "${SUPPLY_PATCH}" \
    "${INTEGRATION_TEST_PATCH}" \
    "${LITHO_TEST_FIXTURES_PATCH}" \
    "${STATEDB_GUARD_PATCH}" \
    "${STATEDB_PRECOMPILE_REGRESSION_PATCH}" > "${EVIDENCE_DIR}/patches.sha256"
{
    echo "release_id=${RELEASE_ID}"
    echo "release_manifest_version=${RELEASE_MANIFEST_VERSION}"
    echo "evmos_commit=${ACTUAL_EVMOS_COMMIT}"
    echo "cosmos_sdk_commit=${ACTUAL_SDK_COMMIT}"
    echo "evmos_final_source_diff_sha256=${FROZEN_EVMOS_DIFF_SHA256}"
    echo "cosmos_sdk_final_source_diff_sha256=${FROZEN_SDK_DIFF_SHA256}"
    echo "go_version=$(go env GOVERSION)"
    echo "build_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    uname -a
    git --version
    gcc --version | head -1
    make --version | head -1
} > "${EVIDENCE_DIR}/build-environment.txt"

verify_frozen_source
(
    cd "${EVIDENCE_DIR}"
    find . -type f ! -name 'SHA256SUMS.txt' -print0 \
        | sort -z \
        | xargs -0 sha256sum
) > "${EVIDENCE_DIR}/SHA256SUMS.txt"

echo "Evidence directory: ${EVIDENCE_DIR}"
echo "Binary SHA-256: $(sha256sum "${EVIDENCE_DIR}/lithod" | awk '{print $1}')"
echo "SBOM SHA-256: $(sha256sum "${EVIDENCE_DIR}/lithod.cdx.json" | awk '{print $1}')"
echo "Evidence manifest: ${EVIDENCE_DIR}/SHA256SUMS.txt"

echo ""
echo "Next steps:"
echo "  1. Verify:  ./bin/lithod version"
echo "  2. Genesis: bash scripts/generate_lithosphere_genesis.sh"
echo "  3. Deploy:  ansible-playbook -i inventory/hosts playbooks/site.yml --tags binary,genesis"
echo "  4. Submit the complete evidence directory to Autha for R1 review"
echo "  5. Do not deploy until Autha accepts this exact release identity"
