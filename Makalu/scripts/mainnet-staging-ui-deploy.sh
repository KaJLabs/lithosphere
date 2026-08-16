#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lithoscan-mainnet-staging/ui}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.mainnet-staging-ui.yaml"
ENV_FILE="$DEPLOY_DIR/.env.ui"

[[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] || {
  echo "staging UI compose or environment file missing in $DEPLOY_DIR" >&2; exit 1;
}
if grep -q '<[^>]*>' "$ENV_FILE"; then
  echo "staging UI environment contains unresolved placeholders" >&2; exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ "${COMPOSE_PROJECT_NAME:-}" == "lithoscan-mainnet-staging" ]] || {
  echo "refusing staging UI deploy outside the isolated Compose project" >&2; exit 1;
}
[[ "${CHAIN_ID:-}" == "lithosphere_9005-1" && "${LITHO_CHAIN_ID:-}" == "9005" ]] || {
  echo "refusing staging UI deploy for a non-mainnet chain" >&2; exit 1;
}
[[ "${FAUCET_ENABLED:-}" == "false" && "${BRIDGE_ENABLED:-}" == "false" \
  && "${MULTX_ENABLED:-}" == "false" && "${SWAP_ENABLED:-}" == "false" ]] || {
  echo "refusing staging UI deploy while a launch-disabled feature is enabled" >&2; exit 1;
}
[[ "${API_IMAGE_TAG:-}" =~ ^staging-sha-[0-9a-f]{40}$ \
  && "${EXPLORER_IMAGE_TAG:-}" =~ ^staging-sha-[0-9a-f]{40}$ ]] || {
  echo "refusing mutable or non-staging image tags" >&2; exit 1;
}

docker network inspect "${INDEXER_NETWORK_NAME:-lithoscan-mainnet-staging_mainnet-internal}" >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull api explorer
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d api explorer

for attempt in {1..30}; do
  api_health="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${API_PORT:-4401}/health" || true)"
  explorer_health="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${EXPLORER_PORT:-3501}/" || true)"
  if [[ "$api_health" == "200" && "$explorer_health" == "200" ]]; then
    echo "Lithoscan staging API and explorer are locally healthy"
    exit 0
  fi
  echo "[$attempt/30] waiting for staging UI: api=$api_health explorer=$explorer_health"
  sleep 10
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >&2
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 100 api explorer >&2
echo "staging UI health gate failed; the mainnet indexer stack was left running" >&2
exit 1
