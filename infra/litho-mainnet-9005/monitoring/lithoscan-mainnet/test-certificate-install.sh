#!/usr/bin/env bash
set -Eeuo pipefail

readonly script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly helper="$script_dir/lithoscan-nginx-cutover"
readonly test_user=$(id -un)
readonly test_group=$(id -gn)
readonly test_uid=$(id -u)
test_dir=$(mktemp -d /tmp/lithoscan-install-test.XXXXXX)

cleanup() {
    case "$test_dir" in
        /tmp/lithoscan-install-test.*)
            rm -rf -- "$test_dir"
            ;;
        *)
            echo "Refusing unsafe test cleanup path: $test_dir" >&2
            ;;
    esac
}
trap cleanup EXIT HUP INT TERM

readonly test_helper="$test_dir/lithoscan-nginx-cutover"
readonly test_upload="$test_dir/opt/lithoscan-mainnet/tls-staging"
readonly test_cert="$test_dir/etc/letsencrypt/live/lithoscan.ai/fullchain.pem"
readonly test_key="$test_dir/etc/letsencrypt/live/lithoscan.ai/privkey.pem"

# Redirect every privileged data path into the disposable test root. Absolute
# system tool paths stay unchanged, so the production validation/install logic
# itself is exercised.
sed \
    -e "s|/etc/letsencrypt|$test_dir/etc/letsencrypt|g" \
    -e "s|/var/lib/lithoscan-nginx-cutover|$test_dir/var/lib/lithoscan-nginx-cutover|g" \
    -e "s|/opt/lithoscan-mainnet/tls-staging|$test_upload|g" \
    -e "s|readonly deploy_user=lithoscan-deploy|readonly deploy_user=$test_user|" \
    -e "s|readonly privileged_user=root|readonly privileged_user=$test_user|" \
    -e "s|readonly privileged_group=root|readonly privileged_group=$test_group|" \
    -e "s|readonly privileged_uid=0|readonly privileged_uid=$test_uid|" \
    "$helper" > "$test_helper"
chmod 0700 "$test_helper"

install -d -o "$test_user" -g "$test_group" -m 0700 "$test_upload"
install -d -o "$test_user" -g "$test_group" -m 0700 "$test_dir/material"

openssl req -x509 -newkey rsa:2048 -nodes -days 1 -sha256 \
    -subj /CN=lithoscan.ai \
    -addext subjectAltName=DNS:lithoscan.ai \
    -keyout "$test_dir/material/good.key" \
    -out "$test_dir/material/good.crt" >/dev/null 2>&1
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
    -out "$test_dir/material/wrong.key" >/dev/null 2>&1

stage_pair() {
    local certificate_source=$1
    local key_source=$2
    install -o "$test_user" -g "$test_group" -m 0600 \
        "$certificate_source" "$test_upload/fullchain.pem"
    install -o "$test_user" -g "$test_group" -m 0600 \
        "$key_source" "$test_upload/privkey.pem"
}

stage_pair "$test_dir/material/good.crt" "$test_dir/material/good.key"
"$test_helper" install-certificate >/dev/null

test "$(stat -c %U:%G:%a "$test_cert")" = "$test_user:$test_group:644"
test "$(stat -c %U:%G:%a "$test_key")" = "$test_user:$test_group:600"
test ! -e "$test_upload/fullchain.pem"
test ! -e "$test_upload/privkey.pem"

cert_hash_before=$(sha256sum "$test_cert")
key_hash_before=$(sha256sum "$test_key")

stage_pair "$test_dir/material/good.crt" "$test_dir/material/wrong.key"
if "$test_helper" install-certificate >/dev/null 2>&1; then
    echo 'Mismatched certificate/key installation unexpectedly passed.' >&2
    exit 1
fi

test "$cert_hash_before" = "$(sha256sum "$test_cert")"
test "$key_hash_before" = "$(sha256sum "$test_key")"

echo 'Restricted certificate installation tests passed.'
