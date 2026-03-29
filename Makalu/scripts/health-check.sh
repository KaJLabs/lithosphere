#!/bin/bash
# ============================================================================
# Lithosphere Deployment Health Check Script
# Verifies all services are running correctly after deployment
# ============================================================================
# Usage: ./health-check.sh [HOST] [API_PORT] [METRICS_PORT]
# Example: ./health-check.sh localhost 4000 9090
# ============================================================================

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
HOST="${1:-localhost}"
API_PORT="${2:-4000}"
METRICS_PORT="${3:-9090}"
MAX_RETRIES="${MAX_RETRIES:-5}"
RETRY_DELAY="${RETRY_DELAY:-10}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

check_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="${4:-}"
    
    for i in $(seq 1 $MAX_RETRIES); do
        echo "  Attempt $i of $MAX_RETRIES: Checking $name..."
        
        if [ "$method" = "POST" ] && [ -n "$data" ]; then
            HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" \
                --connect-timeout 10 \
                --max-time 30 \
                -X POST \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$url" 2>/dev/null || echo "000")
        else
            HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" \
                --connect-timeout 10 \
                --max-time 30 \
                "$url" 2>/dev/null || echo "000")
        fi
        
        if [ "$HTTP_CODE" = "200" ]; then
            log_info "✅ $name check passed (HTTP $HTTP_CODE)"
            return 0
        else
            log_warn "⚠️ $name returned HTTP $HTTP_CODE"
            if [ -f /tmp/response.txt ] && [ -s /tmp/response.txt ]; then
                echo "  Response: $(head -c 200 /tmp/response.txt)"
            fi
            
            if [ $i -lt $MAX_RETRIES ]; then
                echo "  Retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    log_error "❌ $name check failed after $MAX_RETRIES attempts"
    return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Main Health Checks
# ─────────────────────────────────────────────────────────────────────────────
echo "============================================================================"
echo "Lithosphere Health Check"
echo "============================================================================"
echo "Host: $HOST"
echo "API Port: $API_PORT"
echo "Metrics Port: $METRICS_PORT"
echo "============================================================================"
echo ""

FAILED=0

# Check 1: API Health Endpoint
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Check 1: API Health Endpoint"
echo "─────────────────────────────────────────────────────────────────────────────"
if ! check_endpoint "API Health" "http://$HOST:$API_PORT/health"; then
    FAILED=$((FAILED + 1))
fi
echo ""

# Check 2: GraphQL Endpoint
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Check 2: GraphQL Endpoint"
echo "─────────────────────────────────────────────────────────────────────────────"
GRAPHQL_QUERY='{"query":"{ __typename }"}'
if ! check_endpoint "GraphQL" "http://$HOST:$API_PORT/graphql" "POST" "$GRAPHQL_QUERY"; then
    log_warn "GraphQL endpoint may not be fully configured"
fi
echo ""

# Check 3: Metrics Endpoint
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Check 3: Prometheus Metrics Endpoint"
echo "─────────────────────────────────────────────────────────────────────────────"
if ! check_endpoint "Metrics" "http://$HOST:$METRICS_PORT/metrics"; then
    log_warn "Metrics endpoint not available (optional)"
fi
echo ""

# Check 4: Docker Container Status
echo "─────────────────────────────────────────────────────────────────────────────"
echo "Check 4: Container Status"
echo "─────────────────────────────────────────────────────────────────────────────"
if command -v docker &> /dev/null; then
    echo "Running containers:"
    docker ps --filter "name=litho-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  Unable to query Docker"
else
    log_warn "Docker CLI not available, skipping container check"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo "============================================================================"
echo "Health Check Summary"
echo "============================================================================"

if [ $FAILED -eq 0 ]; then
    log_info "🎉 All critical health checks passed!"
    echo ""
    echo "Service URLs:"
    echo "  - API:      http://$HOST:$API_PORT"
    echo "  - GraphQL:  http://$HOST:$API_PORT/graphql"
    echo "  - Metrics:  http://$HOST:$METRICS_PORT/metrics"
    echo ""
    exit 0
else
    log_error "❌ $FAILED critical health check(s) failed"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check container logs: docker compose logs -f"
    echo "  2. Verify environment variables in .env"
    echo "  3. Ensure database is accessible"
    echo "  4. Check network connectivity"
    echo ""
    exit 1
fi
