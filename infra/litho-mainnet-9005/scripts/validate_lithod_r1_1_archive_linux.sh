#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "usage: validate_lithod_r1_1_archive_linux.sh ARCHIVE.zip" >&2
    exit 2
fi

archive="$(realpath "$1")"
tmp="$(mktemp -d /tmp/litho-r1-1-verify.XXXXXX)"
case "${tmp}" in
    /tmp/litho-r1-1-verify.*) ;;
    *) echo "ERROR: unsafe temporary directory" >&2; exit 90 ;;
esac
cleanup() {
    rm -rf -- "${tmp}"
}
trap cleanup EXIT

unzip -t "${archive}" >/dev/null
unzip -q "${archive}" -d "${tmp}"
root="${tmp}/litho-l1-v20.0.0-r1.1"

[[ "$(stat -c '%a' "${root}/bin/lithod")" == "755" ]]
actual_hash="$(sha256sum "${root}/bin/lithod" | awk '{print $1}')"
expected_hash="1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc"
[[ "${actual_hash}" == "${expected_hash}" ]]
version="$(${root}/bin/lithod version)"
[[ "${version}" == "20.0.0" ]]

printf 'archive_paths=POSIX_OK\n'
printf 'binary_mode=755\n'
printf 'binary_sha256=%s\n' "${actual_hash}"
printf 'binary_version=%s\n' "${version}"
