#!/usr/bin/env bash
set -euo pipefail

BINARY=""
OUTPUT_DIR=""
RELEASE_VERSION=""
TOOL_VERSION=""
TOOL_SHA256=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --binary) BINARY="$2"; shift 2 ;;
        --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
        --release-version) RELEASE_VERSION="$2"; shift 2 ;;
        --tool-version) TOOL_VERSION="$2"; shift 2 ;;
        --tool-sha256) TOOL_SHA256="$2"; shift 2 ;;
        *) echo "ERROR: unknown argument: $1" >&2; exit 2 ;;
    esac
done

for value_name in BINARY OUTPUT_DIR RELEASE_VERSION TOOL_VERSION TOOL_SHA256; do
    if [[ -z "${!value_name}" ]]; then
        echo "ERROR: missing required value: ${value_name}" >&2
        exit 2
    fi
done

if [[ ! -x "${BINARY}" ]]; then
    echo "ERROR: binary is missing or not executable: ${BINARY}" >&2
    exit 1
fi

for cmd in curl sha256sum tar; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
        echo "ERROR: required SBOM command is missing: ${cmd}" >&2
        exit 1
    fi
done

mkdir -p "${OUTPUT_DIR}"
TMP_DIR="$(mktemp -d)"
cleanup() {
    rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

ARCHIVE="cyclonedx-gomod_${TOOL_VERSION}_linux_amd64.tar.gz"
URL="https://github.com/CycloneDX/cyclonedx-gomod/releases/download/v${TOOL_VERSION}/${ARCHIVE}"

curl --fail --location --proto '=https' --tlsv1.2 \
    --output "${TMP_DIR}/${ARCHIVE}" "${URL}"
echo "${TOOL_SHA256}  ${TMP_DIR}/${ARCHIVE}" | sha256sum --check --strict
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"

TOOL="${TMP_DIR}/cyclonedx-gomod"
if [[ ! -x "${TOOL}" ]]; then
    echo "ERROR: verified CycloneDX generator archive did not contain the expected executable" >&2
    exit 1
fi

SBOM="${OUTPUT_DIR}/lithod.cdx.json"
"${TOOL}" bin \
    -json \
    -output-version 1.6 \
    -output "${SBOM}" \
    -version "${RELEASE_VERSION}" \
    "${BINARY}"

if [[ ! -s "${SBOM}" ]]; then
    echo "ERROR: CycloneDX SBOM was not generated" >&2
    exit 1
fi

grep -q '"bomFormat"[[:space:]]*:[[:space:]]*"CycloneDX"' "${SBOM}"
grep -q '"specVersion"[[:space:]]*:[[:space:]]*"1.6"' "${SBOM}"
sha256sum "${SBOM}" > "${SBOM}.sha256"

echo "SBOM: ${SBOM}"
echo "SBOM SHA-256: $(awk '{print $1}' "${SBOM}.sha256")"
