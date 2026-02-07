#!/bin/bash
# ============================================================================
# Lithosphere Phase 5 - Monitoring Stack Deployment Script
# ============================================================================
# This script deploys the complete observability stack for Lithosphere
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Script
# ─────────────────────────────────────────────────────────────────────────────
echo "============================================================================"
echo "  Lithosphere Phase 5 - Observability & Logging Stack"
echo "============================================================================"
echo ""

# Check prerequisites
log_step "Checking prerequisites..."
check_command "docker"
check_command "docker compose"
check_command "jq"

# Check if we're in the Makulu directory
if [ ! -f "docker-compose.yaml" ]; then
    log_error "docker-compose.yaml not found. Please run this script from the Makulu directory."
    exit 1
fi

if [ ! -f "docker-compose.monitoring.yaml" ]; then
    log_error "docker-compose.monitoring.yaml not found. Please ensure Phase 5 files are in place."
    exit 1
fi

log_info "✅ All prerequisites met"

# Create necessary directories
log_step "Creating required directories..."
mkdir -p infra/loki
mkdir -p infra/promtail
mkdir -p infra/prometheus/alerts
mkdir -p infra/alertmanager
mkdir -p infra/grafana/provisioning/datasources
mkdir -p infra/grafana/provisioning/dashboards
mkdir -p infra/grafana/dashboards

log_info "✅ Directories created"

# Check if .env file exists
if [ ! -f ".env" ]; then
    log_warn ".env file not found. Creating from .env.testnet..."
    cp .env.testnet .env
    log_info "✅ Created .env file from template"
else
    log_info "✅ .env file exists"
fi

# Prompt for deployment mode
echo ""
echo "Select deployment mode:"
echo "1) Full stack (Base services + Monitoring)"
echo "2) Monitoring only (assumes base services are running)"
echo "3) Stop all services"
echo ""
read -p "Enter your choice [1-3]: " choice

case $choice in
    1)
        log_step "Deploying full stack (Base + Monitoring)..."
        
        # Create Docker network if it doesn't exist
        if ! docker network inspect lithosphere_litho-network &> /dev/null; then
            log_info "Creating Docker network..."
            docker network create lithosphere_litho-network
        fi
        
        # Pull latest images
        log_info "Pulling latest images..."
        docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml pull
        
        # Start all services
        log_info "Starting all services..."
        docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
        
        log_info "✅ Full stack deployed successfully"
        ;;
        
    2)
        log_step "Deploying monitoring stack only..."
        
        # Check if base services are running
        if ! docker compose ps | grep -q "litho-api"; then
            log_warn "Base services don't appear to be running. Consider option 1."
            read -p "Continue anyway? [y/N]: " confirm
            if [[ ! $confirm =~ ^[Yy]$ ]]; then
                log_info "Deployment cancelled"
                exit 0
            fi
        fi
        
        # Pull latest monitoring images
        log_info "Pulling monitoring images..."
        docker compose -f docker-compose.monitoring.yaml pull
        
        # Start monitoring services
        log_info "Starting monitoring services..."
        docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d \
            prometheus node-exporter cadvisor grafana loki promtail alertmanager
        
        log_info "✅ Monitoring stack deployed successfully"
        ;;
        
    3)
        log_step "Stopping all services..."
        docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml down
        log_info "✅ All services stopped"
        exit 0
        ;;
        
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

# Wait for services to start
log_step "Waiting for services to initialize (30 seconds)..."
sleep 30

# Health checks
log_step "Running health checks..."

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    local retries=5
    
    for i in $(seq 1 $retries); do
        if curl -s -f -o /dev/null --max-time 5 "$url" 2>/dev/null; then
            log_info "✅ $name is healthy"
            return 0
        fi
        sleep 2
    done
    
    log_warn "⚠️  $name is not responding"
    return 1
}

# Get server IP (try to detect or use localhost)
SERVER_IP="${SERVER_IP:-localhost}"

# Check services
FAILED=0

check_service "API" "http://$SERVER_IP:4000/health" || FAILED=$((FAILED+1))
check_service "Prometheus" "http://$SERVER_IP:9091/-/healthy" || FAILED=$((FAILED+1))
check_service "Grafana" "http://$SERVER_IP:3001/api/health" || FAILED=$((FAILED+1))
check_service "Loki" "http://$SERVER_IP:3100/ready" || FAILED=$((FAILED+1))

# Display summary
echo ""
echo "============================================================================"
echo "  Deployment Summary"
echo "============================================================================"
echo ""

if [ $FAILED -eq 0 ]; then
    log_info "✅ All services are healthy!"
else
    log_warn "⚠️  $FAILED service(s) failed health checks"
fi

echo ""
echo "📊 Access your monitoring dashboards:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  🎨 Grafana:       http://$SERVER_IP:3001"
echo "     Username: admin"
echo "     Password: lithosphere"
echo ""
echo "  📈 Prometheus:    http://$SERVER_IP:9091"
echo "  📊 cAdvisor:      http://$SERVER_IP:8080"
echo "  🔔 Alertmanager:  http://$SERVER_IP:9093"
echo ""
echo "  🚀 API:           http://$SERVER_IP:4000"
echo "  🔍 GraphQL:       http://$SERVER_IP:4000/graphql"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show running containers
log_step "Running containers:"
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml ps

echo ""
log_info "📖 For detailed documentation, see: PHASE5_OBSERVABILITY_GUIDE.md"
echo ""

# Offer to show logs
read -p "Would you like to view live logs? [y/N]: " show_logs
if [[ $show_logs =~ ^[Yy]$ ]]; then
    docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml logs -f
fi
