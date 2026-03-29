#!/bin/bash
# ============================================================================
# Lithosphere Manual Rollback Script
# Restores previous deployment state from rollback snapshot
# ============================================================================
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/lithosphere/Makalu}"
ROLLBACK_DIR="${DEPLOY_PATH}/.rollback"
SLOT_FILE="${DEPLOY_PATH}/.active-slot"

if [ ! -d "$ROLLBACK_DIR" ]; then
  echo "No rollback snapshot found at ${ROLLBACK_DIR}"
  echo "Cannot rollback — no previous deployment state saved"
  exit 1
fi

echo "=== Lithosphere Rollback ==="
echo "Deploy path: ${DEPLOY_PATH}"

# Restore previous compose file if backed up
if [ -f "${ROLLBACK_DIR}/docker-compose.yaml.bak" ]; then
  echo "Restoring previous docker-compose.yaml..."
  cp "${ROLLBACK_DIR}/docker-compose.yaml.bak" "${DEPLOY_PATH}/docker-compose.yaml"
fi

# Restore previous .env if backed up
if [ -f "${ROLLBACK_DIR}/.env.bak" ]; then
  echo "Restoring previous .env..."
  cp "${ROLLBACK_DIR}/.env.bak" "${DEPLOY_PATH}/.env"
fi

# Restore previous slot
if [ -f "${ROLLBACK_DIR}/previous-slot" ]; then
  PREV_SLOT=$(cat "${ROLLBACK_DIR}/previous-slot")
  echo "$PREV_SLOT" > "$SLOT_FILE"
  echo "Restored active slot to: ${PREV_SLOT}"
fi

# Restart services with restored config
echo "Restarting services..."
cd "$DEPLOY_PATH"
sudo docker compose down --timeout 30
sudo docker compose up -d --build --remove-orphans

# Health check
echo "Waiting for services to stabilize..."
sleep 15

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 \
  "http://localhost:4000/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
  echo "Rollback successful — API healthy (HTTP 200)"
else
  echo "WARNING: API returned HTTP ${HEALTH_CODE} after rollback"
  echo "Check service logs: sudo docker compose logs --tail 50"
fi

echo ""
echo "=== Rollback Complete ==="
echo "Previous images were:"
cat "${ROLLBACK_DIR}/images.json" 2>/dev/null || echo "(no image snapshot available)"
