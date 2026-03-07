#!/usr/bin/env bash
# =============================================================================
# fix-grafana-no-data.sh
# Diagnose and fix the "No data" issue on grafana.litho.ai
#
# This script runs against the Indexer-EC2 (10.0.10.16) via Bastion SSH and:
#   1. Checks if Prometheus is running (Docker or systemd)
#   2. If not running, deploys the monitoring stack via docker compose
#   3. Tests network connectivity to Validator/Sentry CometBFT (:26660)
#   4. Tests network connectivity to Validator/Sentry node_exporter (:9100)
#   5. Opens AWS Security Group rules for :26660 and :9100
#   6. Queries Prometheus /api/v1/targets to show scrape health
#   7. Verifies Grafana is healthy
#
# Usage:
#   chmod +x fix-grafana-no-data.sh
#   ./fix-grafana-no-data.sh \
#     --bastion <bastion-public-ip-or-hostname> \
#     --key     <path-to-ssh-private-key>
#
# Optional flags:
#   --bastion-user    <user>   SSH user for bastion       (default: ec2-user)
#   --target-user     <user>   SSH user for Indexer-EC2   (default: ec2-user)
#   --validator-sg    <sg-id>  Security Group ID for Validator
#   --sentry01-sg     <sg-id>  Security Group ID for Sentry 01
#   --sentry02-sg     <sg-id>  Security Group ID for Sentry 02
#   --deploy-dir      <path>   Deployment directory       (default: /opt/lithoscan)
#   --dry-run                  Print commands without executing
#   --diag-only                Run diagnostics only, do not fix anything
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[ OK ]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
fail()    { echo -e "${RED}[FAIL]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}══════════════════════════════════════════════════════════════${RESET}"; echo -e "${BOLD}  $* ${RESET}"; echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"; }

# ── Network topology ─────────────────────────────────────────────────────────
INDEXER_IP="10.0.10.16"

VALIDATOR_IP="10.0.10.65"
SENTRY01_IP="10.0.1.218"
SENTRY02_IP="10.1.1.227"

COMETBFT_PORT=26660
NODE_EXPORTER_PORT=9100
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# ── Defaults ──────────────────────────────────────────────────────────────────
BASTION_HOST=""
BASTION_USER="ec2-user"
TARGET_USER="ec2-user"
SSH_KEY=""
DEPLOY_DIR="/opt/lithoscan"

VALIDATOR_SG=""
SENTRY01_SG=""
SENTRY02_SG=""

DRY_RUN=false
DIAG_ONLY=false

# ── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bastion)        BASTION_HOST="$2";  shift 2 ;;
    --bastion-user)   BASTION_USER="$2";  shift 2 ;;
    --target-user)    TARGET_USER="$2";   shift 2 ;;
    --key)            SSH_KEY="$2";       shift 2 ;;
    --validator-sg)   VALIDATOR_SG="$2";  shift 2 ;;
    --sentry01-sg)    SENTRY01_SG="$2";   shift 2 ;;
    --sentry02-sg)    SENTRY02_SG="$2";   shift 2 ;;
    --deploy-dir)     DEPLOY_DIR="$2";    shift 2 ;;
    --dry-run)        DRY_RUN=true;       shift   ;;
    --diag-only)      DIAG_ONLY=true;     shift   ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ -z "$BASTION_HOST" ]] && error "--bastion <host> is required."

# ── SSH helper ────────────────────────────────────────────────────────────────
SSH_OPTS="-o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15"
[[ -n "$SSH_KEY" ]] && SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
PROXY_OPTS="${SSH_OPTS} -o ProxyJump=${BASTION_USER}@${BASTION_HOST}"

remote() {
  local desc="$1"; shift
  info "Remote: ${desc}"
  if $DRY_RUN; then
    echo -e "  ${YELLOW}[DRY-RUN]${RESET} Would run on ${INDEXER_IP}:\n$*"
    return 0
  fi
  # shellcheck disable=SC2086
  ssh ${PROXY_OPTS} "${TARGET_USER}@${INDEXER_IP}" "bash -s" <<< "$@"
}

# =============================================================================
echo ""
echo -e "${BOLD}  Lithosphere — Fix grafana.litho.ai 'No Data'${RESET}"
echo -e "${BOLD}  Indexer-EC2:  ${INDEXER_IP}${RESET}"
echo -e "${BOLD}  Bastion:      ${BASTION_HOST}${RESET}"
echo ""
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Verify SSH connectivity
# ─────────────────────────────────────────────────────────────────────────────
step "Step 1 — Verify SSH connectivity (Bastion -> Indexer-EC2)"

info "Testing: localhost -> ${BASTION_USER}@${BASTION_HOST} -> ${TARGET_USER}@${INDEXER_IP}"
if ! $DRY_RUN; then
  # shellcheck disable=SC2086
  if ! ssh ${PROXY_OPTS} "${TARGET_USER}@${INDEXER_IP}" "echo 'SSH OK'" 2>/dev/null; then
    error "Cannot reach ${INDEXER_IP} via bastion ${BASTION_HOST}."
  fi
fi
success "SSH connectivity confirmed."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Check if Prometheus is running
# ─────────────────────────────────────────────────────────────────────────────
step "Step 2 — Check Prometheus status on Indexer-EC2"

PROM_STATUS=$(remote "Check Prometheus container/service" "
set -euo pipefail

echo '── Docker containers matching prometheus ──'
docker ps --filter 'name=prometheus' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'docker not available'

echo ''
echo '── systemctl status ──'
systemctl is-active prometheus 2>/dev/null || echo 'not-systemd'

echo ''
echo '── Health check ──'
if curl -sf --max-time 5 http://localhost:9090/-/healthy 2>/dev/null; then
  echo 'PROMETHEUS_HEALTHY=true'
else
  echo 'PROMETHEUS_HEALTHY=false'
fi
" 2>&1) || true

echo "$PROM_STATUS"

if echo "$PROM_STATUS" | grep -q "PROMETHEUS_HEALTHY=true"; then
  success "Prometheus is running and healthy."
else
  warn "Prometheus is NOT healthy. Will attempt to start it."

  if ! $DIAG_ONLY; then
    step "Step 2a — Deploy/restart monitoring stack"

    remote "Start monitoring stack via docker compose" "
set -euo pipefail
cd '${DEPLOY_DIR}'

# Find compose files
MAIN_COMPOSE=''
MON_COMPOSE=''
for f in docker-compose.yaml docker-compose.yml compose.yaml compose.yml; do
  [[ -f \"\$f\" ]] && MAIN_COMPOSE=\"\$f\" && break
done
for f in docker-compose.monitoring.yaml docker-compose.monitoring.yml; do
  [[ -f \"\$f\" ]] && MON_COMPOSE=\"\$f\" && break
done

if [[ -z \"\$MAIN_COMPOSE\" ]]; then
  echo 'ERROR: No docker-compose.yaml found in ${DEPLOY_DIR}' >&2
  exit 1
fi

echo \"Using: \$MAIN_COMPOSE + \${MON_COMPOSE:-'(none)'}\"

# Pull and start monitoring services
if [[ -n \"\$MON_COMPOSE\" ]]; then
  echo 'Pulling monitoring images...'
  docker compose -f \"\$MAIN_COMPOSE\" -f \"\$MON_COMPOSE\" pull prometheus node-exporter cadvisor grafana loki promtail alertmanager 2>/dev/null || true

  echo 'Starting monitoring stack...'
  docker compose -f \"\$MAIN_COMPOSE\" -f \"\$MON_COMPOSE\" up -d prometheus node-exporter cadvisor grafana loki promtail alertmanager
else
  echo 'No monitoring compose file found. Starting prometheus from main compose...'
  docker compose -f \"\$MAIN_COMPOSE\" up -d prometheus 2>/dev/null || true
fi

echo 'Waiting 15 seconds for services to stabilise...'
sleep 15

echo ''
echo '── Verify Prometheus after restart ──'
docker ps --filter 'name=prometheus' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -sf --max-time 5 http://localhost:9090/-/healthy && echo 'Prometheus now healthy' || echo 'Prometheus still not healthy'
"
    success "Monitoring stack deployment attempted."
  else
    info "[DIAG-ONLY] Skipping Prometheus deployment."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Test connectivity from Indexer to Validator/Sentries
# ─────────────────────────────────────────────────────────────────────────────
step "Step 3 — Test network connectivity to Validator & Sentry nodes"

remote "Connectivity tests for CometBFT (:${COMETBFT_PORT}) and node_exporter (:${NODE_EXPORTER_PORT})" "
set -uo pipefail

echo '── CometBFT Metrics (port ${COMETBFT_PORT}) ──────────────────────'
for TARGET in '${VALIDATOR_IP}:validator' '${SENTRY01_IP}:sentry-01' '${SENTRY02_IP}:sentry-02'; do
  IP=\${TARGET%%:*}
  LABEL=\${TARGET##*:}
  printf '  %-12s (%s:%s) -> ' \"\$LABEL\" \"\$IP\" '${COMETBFT_PORT}'
  if timeout 3 bash -c \"echo > /dev/tcp/\$IP/${COMETBFT_PORT}\" 2>/dev/null; then
    echo 'REACHABLE'
  else
    echo 'BLOCKED / UNREACHABLE'
  fi
done

echo ''
echo '── Node Exporter (port ${NODE_EXPORTER_PORT}) ─────────────────────'
for TARGET in '${VALIDATOR_IP}:validator' '${SENTRY01_IP}:sentry-01' '${SENTRY02_IP}:sentry-02'; do
  IP=\${TARGET%%:*}
  LABEL=\${TARGET##*:}
  printf '  %-12s (%s:%s) -> ' \"\$LABEL\" \"\$IP\" '${NODE_EXPORTER_PORT}'
  if timeout 3 bash -c \"echo > /dev/tcp/\$IP/${NODE_EXPORTER_PORT}\" 2>/dev/null; then
    echo 'REACHABLE'
  else
    echo 'BLOCKED / UNREACHABLE'
  fi
done

echo ''
echo '── Quick curl tests ──────────────────────────────────────────────'
echo -n '  Validator CometBFT metrics: '
curl -sf --max-time 3 http://${VALIDATOR_IP}:${COMETBFT_PORT}/metrics | head -1 || echo 'FAILED'

echo -n '  Validator node_exporter:    '
curl -sf --max-time 3 http://${VALIDATOR_IP}:${NODE_EXPORTER_PORT}/metrics | head -1 || echo 'FAILED'
"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Open Security Group rules (if SG IDs provided)
# ─────────────────────────────────────────────────────────────────────────────
step "Step 4 — AWS Security Groups: allow :${COMETBFT_PORT} and :${NODE_EXPORTER_PORT} from Indexer"

open_sg_port() {
  local sg_id="$1"
  local port="$2"
  local label="$3"

  if [[ -z "$sg_id" ]]; then
    warn "No SG ID provided for ${label} — skipping port ${port}."
    return 0
  fi

  info "Checking ${label} SG ${sg_id} for TCP/${port} from ${INDEXER_IP}/32..."

  if $DRY_RUN || $DIAG_ONLY; then
    echo -e "  ${YELLOW}[$(if $DIAG_ONLY; then echo 'DIAG-ONLY'; else echo 'DRY-RUN'; fi)]${RESET} Would authorize TCP/${port} from ${INDEXER_IP}/32 on ${sg_id}"
    return 0
  fi

  # Check if rule already exists
  EXISTING=$(aws ec2 describe-security-groups \
    --group-ids "$sg_id" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`${port}\` && contains(IpRanges[].CidrIp, '${INDEXER_IP}/32')] | length(@)" \
    --output text 2>/dev/null || echo "0")

  if [[ "$EXISTING" -gt 0 ]]; then
    success "${label}: TCP/${port} from ${INDEXER_IP}/32 already allowed."
  else
    info "Adding TCP/${port} from ${INDEXER_IP}/32 to ${sg_id}..."
    aws ec2 authorize-security-group-ingress \
      --group-id "$sg_id" \
      --ip-permissions "IpProtocol=tcp,FromPort=${port},ToPort=${port},IpRanges=[{CidrIp=${INDEXER_IP}/32,Description=Prometheus scrape from Indexer}]"
    success "${label}: TCP/${port} rule added."
  fi
}

# CometBFT metrics port (26660)
open_sg_port "$VALIDATOR_SG" "$COMETBFT_PORT" "Validator"
open_sg_port "$SENTRY01_SG"  "$COMETBFT_PORT" "Sentry-01"
open_sg_port "$SENTRY02_SG"  "$COMETBFT_PORT" "Sentry-02"

# Node Exporter port (9100)
open_sg_port "$VALIDATOR_SG" "$NODE_EXPORTER_PORT" "Validator"
open_sg_port "$SENTRY01_SG"  "$NODE_EXPORTER_PORT" "Sentry-01"
open_sg_port "$SENTRY02_SG"  "$NODE_EXPORTER_PORT" "Sentry-02"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Check if node_exporter is running on Validator/Sentries
# ─────────────────────────────────────────────────────────────────────────────
step "Step 5 — Verify node_exporter on Validator & Sentries (from Indexer)"

remote "Check node_exporter on all nodes" "
echo '── node_exporter health checks ──────────────────────────────────'
for TARGET in '${VALIDATOR_IP}:validator' '${SENTRY01_IP}:sentry-01' '${SENTRY02_IP}:sentry-02'; do
  IP=\${TARGET%%:*}
  LABEL=\${TARGET##*:}
  printf '  %-12s -> ' \"\$LABEL\"
  RESULT=\$(curl -sf --max-time 5 http://\$IP:${NODE_EXPORTER_PORT}/metrics 2>/dev/null | head -3)
  if [[ -n \"\$RESULT\" ]]; then
    echo 'RUNNING (metrics returned)'
  else
    echo 'NOT RESPONDING — node_exporter may not be installed'
    echo '    Fix: SSH to \$IP and run:'
    echo '      sudo apt-get install -y prometheus-node-exporter'
    echo '      sudo systemctl enable --now prometheus-node-exporter'
    echo '    Or deploy via: ansible-playbook -i inventory/hosts playbooks/deploy-monitoring.yml'
  fi
done
"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Query Prometheus scrape targets
# ─────────────────────────────────────────────────────────────────────────────
step "Step 6 — Prometheus scrape target status"

remote "Query Prometheus targets API" "
echo '── Prometheus Scrape Targets ─────────────────────────────────────'
TARGETS=\$(curl -sf --max-time 10 http://localhost:${PROMETHEUS_PORT}/api/v1/targets 2>/dev/null)
if [[ -z \"\$TARGETS\" ]]; then
  echo 'ERROR: Cannot reach Prometheus API at localhost:${PROMETHEUS_PORT}'
  echo 'Prometheus may not be running or may be mapped to a different port.'
  echo 'Check: docker ps --filter name=prometheus'
  exit 0
fi

echo ''
echo \"\$TARGETS\" | jq -r '
  .data.activeTargets[] |
  \"  [\(.health | if . == \"up\" then \"  UP  \" else \" DOWN \" end)] job=\(.labels.job) instance=\(.scrapePool // .labels.instance) last_error=\(.lastError // \"none\")\"
' 2>/dev/null || echo \"\$TARGETS\" | python3 -c \"
import json, sys
data = json.load(sys.stdin)
for t in data.get('data',{}).get('activeTargets',[]):
  health = t.get('health','unknown')
  job = t.get('labels',{}).get('job','?')
  inst = t.get('labels',{}).get('instance','?')
  err = t.get('lastError','')
  tag = '  UP  ' if health == 'up' else ' DOWN '
  print(f'  [{tag}] job={job} instance={inst} last_error={err or \"none\"}')
\" 2>/dev/null || echo '  (jq/python3 not available — raw output)' && echo \"\$TARGETS\" | head -100
"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Verify Grafana health
# ─────────────────────────────────────────────────────────────────────────────
step "Step 7 — Grafana health check"

remote "Grafana health and datasource verification" "
echo '── Grafana Health ────────────────────────────────────────────────'
GRAFANA_HEALTH=\$(curl -sf --max-time 5 http://localhost:${GRAFANA_PORT}/api/health 2>/dev/null)
if [[ -n \"\$GRAFANA_HEALTH\" ]]; then
  echo \"  Health: \$GRAFANA_HEALTH\"
else
  echo '  Grafana is NOT responding on port ${GRAFANA_PORT}'
fi

echo ''
echo '── Grafana Datasources ─────────────────────────────────────────'
curl -sf --max-time 5 http://admin:lithosphere@localhost:${GRAFANA_PORT}/api/datasources 2>/dev/null | \
  jq '.[] | {name: .name, type: .type, url: .url, isDefault: .isDefault}' 2>/dev/null || echo '  (could not query datasources)'

echo ''
echo '── Container status ──────────────────────────────────────────────'
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | \
  grep -E 'NAMES|prometheus|grafana|node-exp|cadvisor|loki|promtail|alertmanager' || echo '  No monitoring containers found'
"

# =============================================================================
# Summary
# =============================================================================
step "Summary & Next Steps"

echo ""
echo -e "  ${BOLD}Diagnostics complete.${RESET} Review the output above for:"
echo ""
echo -e "  ${CYAN}1.${RESET} Prometheus running?       — Step 2 output"
echo -e "  ${CYAN}2.${RESET} Network connectivity?     — Step 3 output"
echo -e "     If ports show ${RED}BLOCKED${RESET}, check Security Groups (Step 4)"
echo -e "     and ensure VPC routing allows ${INDEXER_IP} -> Validator/Sentries"
echo -e "  ${CYAN}3.${RESET} Security Groups updated?  — Step 4 output"
echo -e "     Pass --validator-sg, --sentry01-sg, --sentry02-sg to auto-fix"
echo -e "  ${CYAN}4.${RESET} node_exporter running?    — Step 5 output"
echo -e "     If not running, SSH to each node and install prometheus-node-exporter"
echo -e "  ${CYAN}5.${RESET} Scrape targets healthy?   — Step 6 output"
echo -e "     All targets should show [  UP  ]"
echo -e "  ${CYAN}6.${RESET} Grafana healthy?          — Step 7 output"
echo ""
echo -e "  ${BOLD}Quick fix commands if node_exporter is missing:${RESET}"
echo ""
echo -e "  ${CYAN}# SSH to each Validator/Sentry and run:${RESET}"
echo -e "  sudo apt-get update && sudo apt-get install -y prometheus-node-exporter"
echo -e "  sudo systemctl enable --now prometheus-node-exporter"
echo ""
echo -e "  ${BOLD}If Security Groups need updating, re-run with SG IDs:${RESET}"
echo ""
echo -e "  ${CYAN}./fix-grafana-no-data.sh \\\\${RESET}"
echo -e "  ${CYAN}  --bastion <bastion-ip> --key <key-path> \\\\${RESET}"
echo -e "  ${CYAN}  --validator-sg sg-XXXXX \\\\${RESET}"
echo -e "  ${CYAN}  --sentry01-sg  sg-YYYYY \\\\${RESET}"
echo -e "  ${CYAN}  --sentry02-sg  sg-ZZZZZ${RESET}"
echo ""
