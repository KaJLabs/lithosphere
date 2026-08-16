#!/usr/bin/env bash
set -euo pipefail

EXPECTED_EVM_CHAIN_ID="${EXPECTED_EVM_CHAIN_ID:-9005}"
EXPECTED_COSMOS_CHAIN_ID="${EXPECTED_COSMOS_CHAIN_ID:-lithosphere_9005-1}"
EXPECTED_GENESIS_TIME="${EXPECTED_GENESIS_TIME:-2026-07-27T17:00:00Z}"
EXPECTED_GENESIS_SHA256="${EXPECTED_GENESIS_SHA256:-13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f}"
RPC_URL="${RPC_URL:-https://rpc-mainnet.litho.ai}"
EVM_RPC_URL="${EVM_RPC_URL:-$RPC_URL}"
LCD_URL="${LITHO_LCD_URL:-https://api-mainnet.litho.ai}"
WS_URL="${EVM_WS_URL:-wss://rpc-mainnet.litho.ai/websocket}"
GRPC_URL="${GRPC_URL:-grpc-mainnet.litho.ai:9090}"

required_commands=(curl jq timeout)
if [[ "${REQUIRE_GENESIS:-true}" == "true" ]]; then required_commands+=(sha256sum); fi
for command in "${required_commands[@]}"; do
  command -v "$command" >/dev/null || { echo "required command missing: $command" >&2; exit 1; }
done

actual_sha="runtime-only"
if [[ "${REQUIRE_GENESIS:-true}" == "true" ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  genesis_file="${GENESIS_FILE:-}"
  if [[ -z "$genesis_file" ]]; then
    [[ -n "${GENESIS_URL:-}" ]] || { echo "GENESIS_FILE or GENESIS_URL is required" >&2; exit 1; }
    genesis_file="$tmp_dir/genesis.json"
    curl --fail --silent --show-error --location --max-time 60 "$GENESIS_URL" -o "$genesis_file"
  fi
  [[ -f "$genesis_file" ]] || { echo "genesis file not found: $genesis_file" >&2; exit 1; }

  actual_sha="$(sha256sum "$genesis_file" | awk '{print $1}')"
  [[ "$actual_sha" == "$EXPECTED_GENESIS_SHA256" ]] || {
    echo "genesis SHA mismatch: expected $EXPECTED_GENESIS_SHA256, got $actual_sha" >&2; exit 1;
  }
  [[ "$(jq -r '.chain_id // empty' "$genesis_file")" == "$EXPECTED_COSMOS_CHAIN_ID" ]] || {
    echo "genesis chain_id does not match $EXPECTED_COSMOS_CHAIN_ID" >&2; exit 1;
  }
  [[ "$(jq -r '.genesis_time // empty' "$genesis_file")" == "$EXPECTED_GENESIS_TIME" ]] || {
    echo "genesis_time does not match $EXPECTED_GENESIS_TIME" >&2; exit 1;
  }
fi

curl_retry=(curl --fail --silent --show-error --retry 3 --retry-delay 2 --retry-all-errors --connect-timeout 10 --max-time 20)

status_json="$("${curl_retry[@]}" "$RPC_URL/status")"
rpc_network="$(jq -r '.result.node_info.network // empty' <<<"$status_json")"
[[ "$rpc_network" == "$EXPECTED_COSMOS_CHAIN_ID" ]] || {
  echo "RPC reports Cosmos chain '$rpc_network', expected '$EXPECTED_COSMOS_CHAIN_ID'" >&2; exit 1;
}
[[ "$(jq -r 'if .result.sync_info.catching_up == null then true else .result.sync_info.catching_up end' <<<"$status_json")" == "false" ]] || {
  echo "RPC node is still catching up" >&2; exit 1;
}
[[ "$(jq -r '.result.sync_info.earliest_block_time // empty' <<<"$status_json")" == "$EXPECTED_GENESIS_TIME" ]] || {
  echo "RPC earliest block time does not match $EXPECTED_GENESIS_TIME" >&2; exit 1;
}

evm_json="$("${curl_retry[@]}" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' "$EVM_RPC_URL")"
evm_hex="$(jq -r '.result // empty' <<<"$evm_json")"
[[ "$evm_hex" =~ ^0x[0-9a-fA-F]+$ ]] || { echo "RPC returned an invalid eth_chainId" >&2; exit 1; }
actual_evm_chain_id="$((16#${evm_hex#0x}))"
[[ "$actual_evm_chain_id" == "$EXPECTED_EVM_CHAIN_ID" ]] || {
  echo "RPC reports EVM chain $actual_evm_chain_id, expected $EXPECTED_EVM_CHAIN_ID" >&2; exit 1;
}

lcd_json="$("${curl_retry[@]}" "$LCD_URL/cosmos/base/tendermint/v1beta1/node_info")"
lcd_network="$(jq -r '.default_node_info.network // empty' <<<"$lcd_json")"
[[ "$lcd_network" == "$EXPECTED_COSMOS_CHAIN_ID" ]] || {
  echo "LCD reports Cosmos chain '$lcd_network', expected '$EXPECTED_COSMOS_CHAIN_ID'" >&2; exit 1;
}

grpc_host="${GRPC_URL%:*}"
grpc_port="${GRPC_URL##*:}"
timeout 10 bash -c "</dev/tcp/$grpc_host/$grpc_port" || {
  echo "gRPC endpoint is not accepting TCP connections: $GRPC_URL" >&2; exit 1;
}

ws_http_url="${WS_URL/wss:\/\//https://}"
ws_http_url="${ws_http_url/ws:\/\//http://}"
ws_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 15 \
  --http1.1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: bGl0aG9zcGhlcmUtbWFpbg==' "$ws_http_url" || true)"
[[ "$ws_status" == "101" ]] || { echo "WebSocket handshake returned HTTP $ws_status, expected 101" >&2; exit 1; }

echo "Mainnet identity validated: EVM=$EXPECTED_EVM_CHAIN_ID Cosmos=$EXPECTED_COSMOS_CHAIN_ID genesis=$actual_sha"
