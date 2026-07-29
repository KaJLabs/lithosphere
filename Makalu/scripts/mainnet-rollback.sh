#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lithoscan-mainnet}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.mainnet.yaml"
PREVIOUS_ENV="$DEPLOY_DIR/.release/previous.env"
CURRENT_ENV="$DEPLOY_DIR/.env"

if [[ ! -f "$PREVIOUS_ENV" ]]; then
  [[ -f "$CURRENT_ENV" ]] || { echo "no deployed environment exists" >&2; exit 1; }
  docker compose --env-file "$CURRENT_ENV" -f "$COMPOSE_FILE" down --remove-orphans
  rm -f "$DEPLOY_DIR/.release/current.env"
  echo "Stopped the failed first release; persistent volumes were preserved"
  exit 0
fi
umask 077
cp "$PREVIOUS_ENV" "$CURRENT_ENV"
cp "$PREVIOUS_ENV" "$DEPLOY_DIR/.release/current.env"
docker compose --env-file "$CURRENT_ENV" -f "$COMPOSE_FILE" pull api indexer explorer
docker compose --env-file "$CURRENT_ENV" -f "$COMPOSE_FILE" up -d --remove-orphans
echo "Rolled back to the previous immutable image set"
