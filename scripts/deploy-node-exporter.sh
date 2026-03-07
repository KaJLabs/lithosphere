#!/usr/bin/env bash
# =============================================================================
# deploy-node-exporter.sh
# Install and start node_exporter on Validator & Sentry nodes so Prometheus
# on the Indexer-EC2 can scrape system metrics (:9100).
#
# Usage:
#   chmod +x deploy-node-exporter.sh
#   ./deploy-node-exporter.sh \
#     --bastion <bastion-public-ip> \
#     --key     <path-to-ssh-key>
#
# Optional flags:
#   --bastion-user  <user>   SSH user for bastion   (default: ec2-user)
#   --node-user     <user>   SSH user for nodes     (default: ec2-user)
#   --nodes         <csv>    Comma-separated IPs    (default: 10.0.10.65,10.0.1.218,10.1.1.227)
#   --dry-run                Print commands without executing
#
# This installs node_exporter v1.7.0 as a systemd service listening on :9100.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[ OK ]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }& "C:\Program Files\Git\bin\bash.exe" ./scripts/fix-grafana-no-data.sh --bastion <bastion-ip> --key ~/.ssh/your-key.pem --diag-only& "C:\Program Files\Git\bin\bash.exe" ./scripts/fix-grafana-no-data.sh --bastion <bastion-ip> --key ~/.ssh/your-key.pem --diag-only& "C:\Program Files\Git\bin\bash.exe" ./scripts/fix-grafana-no-data.sh --bastion <bastion-ip> --key ~/.ssh/your-key.pem --diag-only

NODE_EXPORTER_VERSION="1.7.0"

BASTION_HOST=""
BASTION_USER="ec2-user"
NODE_USER="ec2-user"
SSH_KEY=""
DRY_RUN=false
NODES="10.0.10.65,10.0.1.218,10.1.1.227"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bastion)       BASTION_HOST="$2"; shift 2 ;;
    --bastion-user)  BASTION_USER="$2"; shift 2 ;;
    --node-user)     NODE_USER="$2";    shift 2 ;;
    --key)           SSH_KEY="$2";      shift 2 ;;
    --nodes)         NODES="$2";        shift 2 ;;
    --dry-run)       DRY_RUN=true;      shift   ;;
    *) error "Unknown argument: $1" ;;
  esac
done

[[ -z "$BASTION_HOST" ]] && error "--bastion <host> is required."

SSH_OPTS="-o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15"
[[ -n "$SSH_KEY" ]] && SSH_OPTS="${SSH_OPTS} -i ${SSH_KEY}"
PROXY_OPTS="${SSH_OPTS} -o ProxyJump=${BASTION_USER}@${BASTION_HOST}"

IFS=',' read -ra NODE_LIST <<< "$NODES"

LABELS=("validator" "sentry-01" "sentry-02" "node-04" "node-05")

echo ""
echo -e "${BOLD}  Deploy node_exporter v${NODE_EXPORTER_VERSION} to Validator & Sentry nodes${RESET}"
echo ""

for i in "${!NODE_LIST[@]}"; do
  NODE_IP="${NODE_LIST[$i]}"
  LABEL="${LABELS[$i]:-node-$(printf '%02d' $((i+1)))}"

  echo -e "\n${BOLD}── ${LABEL} (${NODE_IP}) ──${RESET}"

  # Check if already running
  info "Checking if node_exporter is already running on ${NODE_IP}..."
  if ! $DRY_RUN; then
    # shellcheck disable=SC2086
    ALREADY_RUNNING=$(ssh ${PROXY_OPTS} "${NODE_USER}@${NODE_IP}" \
      "curl -sf --max-time 3 http://localhost:9100/metrics >/dev/null 2>&1 && echo 'YES' || echo 'NO'" 2>/dev/null) || ALREADY_RUNNING="NO"

    if [[ "$ALREADY_RUNNING" == "YES" ]]; then
      success "node_exporter already running on ${NODE_IP}:9100 — skipping."
      continue
    fi
  fi

  info "Installing node_exporter on ${NODE_IP}..."

  if $DRY_RUN; then
    echo -e "  ${YELLOW}[DRY-RUN]${RESET} Would install node_exporter ${NODE_EXPORTER_VERSION} on ${NODE_IP}"
    continue
  fi

  # shellcheck disable=SC2086
  ssh ${PROXY_OPTS} "${NODE_USER}@${NODE_IP}" "bash -s" << 'INSTALL_EOF'
set -euo pipefail

NODE_EXPORTER_VERSION="1.7.0"
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

# Check if already installed via package manager
if systemctl is-active --quiet prometheus-node-exporter 2>/dev/null; then
  echo "node_exporter already running via systemd (package manager install)"
  exit 0
fi

if systemctl is-active --quiet node_exporter 2>/dev/null; then
  echo "node_exporter already running via systemd"
  exit 0
fi

echo "Downloading node_exporter v${NODE_EXPORTER_VERSION} (${ARCH})..."
cd /tmp
TARBALL="node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}.tar.gz"
curl -sLO "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/${TARBALL}"

echo "Installing..."
tar xzf "${TARBALL}"
sudo cp "node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}/node_exporter" /usr/local/bin/
sudo chmod +x /usr/local/bin/node_exporter
rm -rf "${TARBALL}" "node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}"

# Create systemd user
if ! id -u node_exporter &>/dev/null; then
  sudo useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true
fi

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<'SVCEOF'
[Unit]
Description=Prometheus Node Exporter
Documentation=https://prometheus.io/docs/guides/node-exporter/
After=network-online.target
Wants=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter \
  --collector.filesystem.mount-points-exclude="^/(sys|proc|dev|host|etc)($$|/)" \
  --collector.netclass.ignored-devices="^(veth|docker|br-).*" \
  --web.listen-address=:9100
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter

sleep 2
if curl -sf --max-time 3 http://localhost:9100/metrics >/dev/null 2>&1; then
  echo "node_exporter installed and running on :9100"
else
  echo "WARNING: node_exporter installed but metrics endpoint not responding"
  sudo systemctl status node_exporter --no-pager || true
fi
INSTALL_EOF

  success "node_exporter deployed on ${NODE_IP}."
done

echo ""
echo -e "${BOLD}── Verification ──${RESET}"
echo ""
echo "Run from the Indexer (${CYAN}10.0.10.16${RESET}):"
for NODE_IP in "${NODE_LIST[@]}"; do
  echo "  curl -sf http://${NODE_IP}:9100/metrics | head -3"
done
echo ""
