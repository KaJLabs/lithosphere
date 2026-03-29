#!/bin/bash
# ============================================================================
# Lithosphere Blue/Green Deployment for Docker Compose
# Deploys new version alongside old, health-checks, then cuts over
# ============================================================================
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/lithosphere/Makalu}"
COMPOSE_FILE="${DEPLOY_PATH}/docker-compose.yaml"
HEALTH_URL="${HEALTH_URL:-http://localhost:4000/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-10}"
HEALTH_DELAY="${HEALTH_DELAY:-10}"

# Determine active slot (default: blue)
SLOT_FILE="${DEPLOY_PATH}/.active-slot"
if [ -f "$SLOT_FILE" ]; then
  ACTIVE_SLOT=$(cat "$SLOT_FILE")
else
  ACTIVE_SLOT="blue"
fi

if [ "$ACTIVE_SLOT" = "blue" ]; then
  NEW_SLOT="green"
else
  NEW_SLOT="blue"
fi

echo "Active slot: ${ACTIVE_SLOT} -> Deploying to: ${NEW_SLOT}"

# ── Step 1: Save rollback snapshot ──────────────────────────────────────────
ROLLBACK_DIR="${DEPLOY_PATH}/.rollback"
mkdir -p "$ROLLBACK_DIR"
if [ -f "$COMPOSE_FILE" ]; then
  cp "$COMPOSE_FILE" "${ROLLBACK_DIR}/docker-compose.yaml.bak"
fi
if [ -f "${DEPLOY_PATH}/.env" ]; then
  cp "${DEPLOY_PATH}/.env" "${ROLLBACK_DIR}/.env.bak"
fi
# Record currently running image digests for rollback
sudo docker compose -f "$COMPOSE_FILE" images --format json 2>/dev/null \
  > "${ROLLBACK_DIR}/images.json" || true
echo "$ACTIVE_SLOT" > "${ROLLBACK_DIR}/previous-slot"
echo "Rollback snapshot saved to ${ROLLBACK_DIR}"

# ── Step 2: Build new version with project name for isolation ───────────────
NEW_PROJECT="litho-${NEW_SLOT}"
echo "Building new version as project '${NEW_PROJECT}'..."

# Override ports so new stack doesn't conflict with active
# New stack uses offset ports: API 4010, Explorer 3110
export API_PORT_NEW=4010
export EXPLORER_PORT_NEW=3110

sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" build --no-cache

# Start new stack with temporary port offsets for health checking
sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" up -d \
  --remove-orphans 2>/dev/null || {
    echo "Failed to start new stack — aborting"
    sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" down 2>/dev/null || true
    exit 1
  }

# ── Step 3: Health check new stack ──────────────────────────────────────────
echo "Waiting for new stack to become healthy..."
HEALTHY=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  sleep "$HEALTH_DELAY"
  # Check health on the new stack's containers directly
  CONTAINER=$(sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" ps -q api 2>/dev/null | head -1)
  if [ -n "$CONTAINER" ]; then
    HTTP_CODE=$(sudo docker exec "$CONTAINER" \
      curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 \
      "http://localhost:4000/health" 2>/dev/null || echo "000")
    echo "  Health check attempt $i: HTTP ${HTTP_CODE}"
    if [ "$HTTP_CODE" = "200" ]; then
      HEALTHY=true
      break
    fi
  else
    echo "  Attempt $i: API container not ready yet"
  fi
done

if [ "$HEALTHY" != "true" ]; then
  echo "New stack failed health checks — rolling back"
  sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" down --timeout 30
  echo "Rollback complete — active slot '${ACTIVE_SLOT}' unchanged"
  exit 1
fi

echo "New stack healthy!"

# ── Step 4: Cut over — stop old, promote new ────────────────────────────────
OLD_PROJECT="litho-${ACTIVE_SLOT}"
echo "Cutting over: stopping old project '${OLD_PROJECT}'..."
sudo docker compose -f "$COMPOSE_FILE" -p "$OLD_PROJECT" down --timeout 30 2>/dev/null || true

# Stop the new isolated stack and restart as the default project
sudo docker compose -f "$COMPOSE_FILE" -p "$NEW_PROJECT" down --timeout 30
echo "Starting services as default project..."
sudo docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

# ── Step 5: Record new active slot ──────────────────────────────────────────
echo "$NEW_SLOT" > "$SLOT_FILE"
echo "Active slot is now: ${NEW_SLOT}"

# ── Step 6: Final health verification ──────────────────────────────────────
sleep 10
FINAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 \
  "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$FINAL_CODE" = "200" ]; then
  echo "Blue/green deployment complete — all services healthy"
  exit 0
else
  echo "WARNING: Final health check returned HTTP ${FINAL_CODE}"
  echo "Services may still be starting — check manually"
  exit 0
fi
