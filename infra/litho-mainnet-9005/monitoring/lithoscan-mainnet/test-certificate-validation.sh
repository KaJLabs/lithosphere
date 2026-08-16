#!/usr/bin/env bash
set -Eeuo pipefail

readonly script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly helper="$script_dir/lithoscan-nginx-cutover"
test_dir=$(mktemp -d /tmp/lithoscan-certificate-test.XXXXXX)

cleanup() {
    case "$test_dir" in
        /tmp/lithoscan-certificate-test.*)
            rm -rf -- "$test_dir"
            ;;
        *)
            echo "Refusing unsafe test cleanup path: $test_dir" >&2
            ;;
    esac
}
trap cleanup EXIT HUP INT TERM

# Load only the helper definitions. The privileged command dispatch begins at
# the first standalone require_root call.
sed '/^require_root$/,$d' "$helper" > "$test_dir/functions.sh"

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 \
    -subj /CN=lithoscan.ai \
    -addext subjectAltName=DNS:lithoscan.ai \
    -keyout "$test_dir/good.key" \
    -out "$test_dir/good.crt" >/dev/null 2>&1

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 \
    -subj /CN=example.com \
    -addext subjectAltName=DNS:example.com \
    -keyout "$test_dir/wrong.key" \
    -out "$test_dir/wrong.crt" >/dev/null 2>&1
openssl genpkey -algorithm RSA -aes-256-cbc -pass pass:test-only \
    -pkeyopt rsa_keygen_bits:2048 \
    -out "$test_dir/encrypted.key" >/dev/null 2>&1

(
    # shellcheck source=/dev/null
    source "$test_dir/functions.sh"
    validate_certificate_bundle "$test_dir/good.crt" "$test_dir/good.key"
)

if (
    # shellcheck source=/dev/null
    source "$test_dir/functions.sh"
    validate_certificate_bundle "$test_dir/wrong.crt" "$test_dir/wrong.key"
) >/dev/null 2>&1; then
    echo 'Hostname negative test unexpectedly passed.' >&2
    exit 1
fi

if (
    # shellcheck source=/dev/null
    source "$test_dir/functions.sh"
    validate_certificate_bundle "$test_dir/good.crt" "$test_dir/wrong.key"
) >/dev/null 2>&1; then
    echo 'Certificate/key mismatch test unexpectedly passed.' >&2
    exit 1
fi

if (
    # shellcheck source=/dev/null
    source "$test_dir/functions.sh"
    validate_certificate_bundle "$test_dir/good.crt" "$test_dir/encrypted.key"
) >/dev/null 2>&1; then
    echo 'Encrypted private-key test unexpectedly passed.' >&2
    exit 1
fi

echo 'Certificate validation tests passed.'
