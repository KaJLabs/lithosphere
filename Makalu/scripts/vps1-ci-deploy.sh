#!/bin/bash
set -euo pipefail

cd /opt/lithoscan

image_services=(explorer api indexer faucet)
compose_services=(web api indexer faucet)

for service in "${image_services[@]}"; do
  current_image=$(docker inspect --format '{{.Id}}' "ghcr.io/kajlabs/lithosphere-$service:mainnet" 2>/dev/null || true)
  if [ -n "$current_image" ]; then
    docker tag "$current_image" "ghcr.io/kajlabs/lithosphere-$service:previous"
  fi
done

docker compose pull "${compose_services[@]}"
docker compose up -d "${compose_services[@]}"

docker ps --format '{{.Names}} {{.Status}} {{.Image}}' \
  | grep -E 'lithoscan-(web|api|indexer|faucet)'
