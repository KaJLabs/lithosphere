#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lithoscan-mainnet-staging}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.mainnet-indexer.yaml"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.indexer}"

[[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]] || {
  echo "indexer compose or environment file missing in $DEPLOY_DIR" >&2; exit 1;
}
if grep -q '<[^>]*>' "$ENV_FILE"; then
  echo "indexer environment contains unresolved placeholders" >&2; exit 1;
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

[[ "${CHAIN_ID:-}" == "lithosphere_9005-1" && "${LITHO_CHAIN_ID:-}" == "9005" ]] || {
  echo "refusing indexer start: mainnet chain identity is not exact" >&2; exit 1;
}
[[ "${COMPOSE_PROJECT_NAME:-}" == "lithoscan-mainnet-staging" && "${POSTGRES_DB:-}" == "lithoscan_mainnet_staging" ]] || {
  echo "refusing indexer start: staging project/database isolation is not exact" >&2; exit 1;
}
[[ "${FAUCET_ENABLED:-}" == "false" && "${BRIDGE_ENABLED:-}" == "false" && "${MULTX_ENABLED:-}" == "false" && "${SWAP_ENABLED:-}" == "false" ]] || {
  echo "refusing indexer start: launch features are not disabled" >&2; exit 1;
}
[[ "${IMAGE_TAG:-}" =~ ^sha-[0-9a-f]{40}$ ]] || {
  echo "refusing indexer start: IMAGE_TAG must contain a full immutable commit SHA" >&2; exit 1;
}
for name in RPC_URL EVM_RPC_URL EVM_WS_URL LITHO_LCD_URL GRPC_URL DATABASE_URL REDIS_URL; do
  [[ -n "${!name:-}" ]] || { echo "missing required indexer value: $name" >&2; exit 1; }
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull indexer
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis

postgres_health=""
for attempt in {1..30}; do
  postgres_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q postgres)"
  postgres_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$postgres_id" 2>/dev/null || true)"
  [[ "$postgres_health" == "healthy" ]] && break
  echo "[$attempt/30] waiting for isolated PostgreSQL: ${postgres_health:-not-created}"
  sleep 5
done
[[ "$postgres_health" == "healthy" ]] || { echo "isolated PostgreSQL did not become healthy" >&2; exit 1; }

db_exec=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align)
schema_ready="$("${db_exec[@]}" --command "SELECT to_regclass('public.indexer_state') IS NOT NULL;" | tr -d '[:space:]')"
if [[ "$schema_ready" != "t" ]]; then
  echo "Initializing the empty isolated mainnet schema"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    sh /docker-entrypoint-initdb.d/001-init-mainnet.sh
fi
stored_chain="$("${db_exec[@]}" --command "SELECT value FROM indexer_state WHERE key = 'network_chain_id';" | tr -d '[:space:]')"
[[ -z "$stored_chain" || "$stored_chain" == "lithosphere_9005-1" ]] || {
  echo "refusing indexer start: database belongs to $stored_chain" >&2; exit 1;
}
earliest_block="$("${db_exec[@]}" --command "SELECT COALESCE(to_char(MIN(block_time) AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), '') FROM blocks;" | tr -d '[:space:]')"
[[ -z "$earliest_block" || "$earliest_block" == "2026-07-27T17:00:00Z" ]] || {
  echo "refusing indexer start: database earliest block time is $earliest_block" >&2; exit 1;
}
orphan_seed_count="$("${db_exec[@]}" --command "SELECT CASE WHEN (SELECT COUNT(*) FROM blocks) = 0 THEN (SELECT COUNT(*) FROM accounts) + (SELECT COUNT(*) FROM contracts) ELSE 0 END;" | tr -d '[:space:]')"
[[ "$orphan_seed_count" == "0" ]] || {
  echo "refusing indexer start: pre-seeded account/contract data detected in an unindexed database" >&2; exit 1;
}
"${db_exec[@]}" --command "INSERT INTO indexer_state (key, value, updated_at) VALUES ('network_chain_id', 'lithosphere_9005-1', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();" >/dev/null

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d indexer

for attempt in {1..30}; do
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q indexer)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then
    echo "Mainnet indexer is healthy and synchronizing from block 1"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T indexer \
      wget -qO- http://localhost:9090/metrics \
      | grep -E '^litho_indexer_(last_indexed_block|chain_height) ' || true
    exit 0
  fi
  echo "[$attempt/30] waiting for mainnet indexer health: ${health:-not-created}"
  sleep 10
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 100 indexer >&2
echo "mainnet indexer did not become healthy" >&2
exit 1
