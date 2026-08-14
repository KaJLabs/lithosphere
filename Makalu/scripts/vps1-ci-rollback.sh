#!/bin/bash
set -euo pipefail

cd /opt/lithoscan

image_services=(explorer api indexer)
compose_services=(web api indexer)

for service in "${image_services[@]}"; do
  previous_image="ghcr.io/kajlabs/lithosphere-$service:previous"
  if ! docker image inspect "$previous_image" >/dev/null 2>&1; then
    echo "rollback aborted: missing $previous_image" >&2
    exit 1
  fi
done

for service in "${image_services[@]}"; do
  docker tag \
    "ghcr.io/kajlabs/lithosphere-$service:previous" \
    "ghcr.io/kajlabs/lithosphere-$service:mainnet"
done

docker compose up -d --no-pull "${compose_services[@]}" 2>/dev/null \
  || docker compose up -d "${compose_services[@]}"
echo "rolled back web + api + indexer to :previous"
