#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lithoscan-mainnet}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.mainnet.yaml"
ENV_FILE="$DEPLOY_DIR/.env"
RELEASE_DIR="$DEPLOY_DIR/.release"

[[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] || { echo "compose or environment file missing in $DEPLOY_DIR" >&2; exit 1; }
if grep -q '<[^>]*>' "$ENV_FILE"; then
  echo "environment file contains unresolved placeholders" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ "${LITHO_CHAIN_ID:-}" == "9005" && "${CHAIN_ID:-}" == "lithosphere_9005-1" ]] || {
  echo "refusing deployment: mainnet chain identity is not exact" >&2; exit 1;
}
[[ "${FAUCET_ENABLED:-}" == "false" && "${BRIDGE_ENABLED:-}" == "false" && "${MULTX_ENABLED:-}" == "false" && "${SWAP_ENABLED:-}" == "false" && -z "${SWAP_ROUTER_ADDRESS:-}" ]] || {
  echo "refusing deployment: launch feature flags are not disabled" >&2; exit 1;
}
[[ "${DNS_CUTOVER_ENABLED:-}" == "false" ]] || {
  echo "refusing canary deployment: DNS cutover must remain disabled" >&2; exit 1;
}
[[ "${MONITORING_ENABLED:-}" == "false" ]] || {
  echo "refusing canary deployment: monitoring credentials are not part of this canary" >&2; exit 1;
}
[[ "${IMAGE_TAG:-}" == sha-* && "${EXPLORER_IMAGE_TAG:-}" == *sha-* ]] || {
  echo "refusing mutable image tags; use immutable sha-* tags" >&2; exit 1;
}

umask 077
mkdir -p "$RELEASE_DIR"
if [[ -f "$RELEASE_DIR/current.env" ]]; then cp "$RELEASE_DIR/current.env" "$RELEASE_DIR/previous.env"; fi
cp "$ENV_FILE" "$RELEASE_DIR/current.env"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull api indexer explorer
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

for attempt in {1..30}; do
  api_health="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${API_PORT:-4400}/health" || true)"
  explorer_health="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${EXPLORER_PORT:-3500}/" || true)"
  if [[ "$api_health" == "200" && "$explorer_health" == "200" ]]; then
    echo "Lithoscan stack deployed and locally healthy"
    exit 0
  fi
  echo "[$attempt/30] waiting: api=$api_health explorer=$explorer_health"
  sleep 10
done

echo "deployment health gate failed; invoke mainnet-rollback.sh" >&2
exit 1
