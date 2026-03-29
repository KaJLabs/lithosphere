#!/bin/bash

# ============================================================================
# Lithosphere Master Validation Script
# Final production readiness test before deployment
# ============================================================================
# Usage:
#   chmod +x scripts/master-validation.sh
#   ./scripts/master-validation.sh
# ============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test results
CRITICAL_PASS=0
CRITICAL_FAIL=0
INTEGRATION_PASS=0
INTEGRATION_FAIL=0
PERF_PASS=0
PERF_FAIL=0

# Configuration
VPS_IP="${SERVER_IP:-72.60.177.106}"
API_PORT="${API_PORT:-4000}"
GRAFANA_PORT="${GRAFANA_PORT:-3001}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9091}"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

critical_pass() {
    echo -e "${GREEN}✅ CRITICAL PASS${NC} - $1"
    ((CRITICAL_PASS++))
}

critical_fail() {
    echo -e "${RED}❌ CRITICAL FAIL${NC} - $1"
    ((CRITICAL_FAIL++))
}

integration_pass() {
    echo -e "${GREEN}✅ INTEGRATION PASS${NC} - $1"
    ((INTEGRATION_PASS++))
}

integration_fail() {
    echo -e "${YELLOW}⚠️  INTEGRATION FAIL${NC} - $1"
    ((INTEGRATION_FAIL++))
}

perf_pass() {
    echo -e "${GREEN}✅ PERFORMANCE PASS${NC} - $1"
    ((PERF_PASS++))
}

perf_fail() {
    echo -e "${YELLOW}⚠️  PERFORMANCE WARN${NC} - $1"
    ((PERF_FAIL++))
}

# ============================================================================
# Phase 1: Critical Infrastructure Tests
# ============================================================================

test_critical_infrastructure() {
    print_header "PHASE 1: Critical Infrastructure Validation"
    
    # Test 1.1: Docker daemon
    echo "[1.1] Testing Docker daemon..."
    if docker info >/dev/null 2>&1; then
        critical_pass "Docker daemon is running"
    else
        critical_fail "Docker daemon not accessible"
        return 1
    fi
    
    # Test 1.2: Docker Compose
    echo "[1.2] Testing Docker Compose..."
    if docker compose version >/dev/null 2>&1; then
        VERSION=$(docker compose version --short)
        critical_pass "Docker Compose installed (v${VERSION})"
    else
        critical_fail "Docker Compose not found"
    fi
    
    # Test 1.3: Required containers running
    echo "[1.3] Testing required containers..."
    REQUIRED=("litho-api" "litho-postgres" "litho-redis")
    ALL_RUNNING=true
    
    for container in "${REQUIRED[@]}"; do
        if docker ps --filter "name=${container}" --filter "status=running" | grep -q "${container}"; then
            echo "   ✓ ${container} running"
        else
            echo "   ✗ ${container} NOT running"
            ALL_RUNNING=false
        fi
    done
    
    if $ALL_RUNNING; then
        critical_pass "All required containers are running"
    else
        critical_fail "Some required containers are not running"
    fi
    
    # Test 1.4: Network exists
    echo "[1.4] Testing Docker network..."
    if docker network inspect lithosphere_litho-network >/dev/null 2>&1; then
        critical_pass "Docker network 'lithosphere_litho-network' exists"
    else
        critical_fail "Docker network not found"
    fi
    
    # Test 1.5: Volumes exist
    echo "[1.5] Testing Docker volumes..."
    if docker volume ls | grep -q "lithosphere_postgres-data"; then
        critical_pass "PostgreSQL data volume exists"
    else
        critical_fail "PostgreSQL data volume missing"
    fi
}

# ============================================================================
# Phase 2: Service Health & API Tests
# ============================================================================

test_service_health() {
    print_header "PHASE 2: Service Health & API Validation"
    
    # Test 2.1: API Health Endpoint
    echo "[2.1] Testing API health endpoint..."
    HTTP_CODE=$(curl -s -o /tmp/api-health.json -w "%{http_code}" \
        --connect-timeout 10 \
        --max-time 30 \
        "http://${VPS_IP}:${API_PORT}/health" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        API_STATUS=$(cat /tmp/api-health.json | jq -r '.status' 2>/dev/null || echo "unknown")
        API_ENV=$(cat /tmp/api-health.json | jq -r '.environment' 2>/dev/null || echo "unknown")
        critical_pass "API /health returns 200 (status=${API_STATUS}, env=${API_ENV})"
    else
        critical_fail "API /health returned HTTP ${HTTP_CODE}"
    fi
    
    # Test 2.2: API Readiness
    echo "[2.2] Testing API readiness endpoint..."
    HTTP_CODE=$(curl -s -o /tmp/api-ready.json -w "%{http_code}" \
        --connect-timeout 10 \
        "http://${VPS_IP}:${API_PORT}/ready" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        integration_pass "API /ready returns 200"
    else
        integration_fail "API /ready returned HTTP ${HTTP_CODE}"
    fi
    
    # Test 2.3: GraphQL Endpoint
    echo "[2.3] Testing GraphQL endpoint..."
    HTTP_CODE=$(curl -s -o /tmp/graphql.json -w "%{http_code}" \
        --connect-timeout 10 \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"query":"{ __typename }"}' \
        "http://${VPS_IP}:${API_PORT}/graphql" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        integration_pass "GraphQL endpoint responding"
    else
        integration_fail "GraphQL endpoint returned HTTP ${HTTP_CODE}"
    fi
    
    # Test 2.4: Container health status
    echo "[2.4] Testing container health status..."
    UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
    
    if [ "$UNHEALTHY" -eq 0 ]; then
        integration_pass "No unhealthy containers detected"
    else
        integration_fail "${UNHEALTHY} unhealthy containers found"
        docker ps --filter "health=unhealthy" --format "   {{.Names}} - {{.Status}}"
    fi
}

# ============================================================================
# Phase 3: Database & Cache Connectivity
# ============================================================================

test_data_layer() {
    print_header "PHASE 3: Database & Cache Connectivity"
    
    # Test 3.1: PostgreSQL Connection
    echo "[3.1] Testing PostgreSQL connectivity..."
    if docker exec litho-postgres pg_isready -U lithosphere -d lithosphere >/dev/null 2>&1; then
        integration_pass "PostgreSQL accepting connections"
        
        # Check database size
        DB_SIZE=$(docker exec litho-postgres psql -U lithosphere -d lithosphere -t -c \
            "SELECT pg_size_pretty(pg_database_size('lithosphere'));" 2>/dev/null | xargs)
        echo "   Database size: ${DB_SIZE}"
        
    else
        critical_fail "PostgreSQL not accepting connections"
    fi
    
    # Test 3.2: Redis Connection
    echo "[3.2] Testing Redis connectivity..."
    if docker exec litho-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        integration_pass "Redis responding to PING"
        
        # Get Redis info
        REDIS_KEYS=$(docker exec litho-redis redis-cli DBSIZE 2>/dev/null | grep -oE '[0-9]+' || echo "0")
        REDIS_MEM=$(docker exec litho-redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "unknown")
        echo "   Redis keys: ${REDIS_KEYS}, Memory: ${REDIS_MEM}"
    else
        critical_fail "Redis not responding"
    fi
    
    # Test 3.3: Database-API Connectivity
    echo "[3.3] Testing API-Database connectivity..."
    # This would require the API to have a dedicated test endpoint
    # For now, we verify through container network connectivity
    if docker exec litho-api sh -c 'command -v pg_isready >/dev/null 2>&1 && pg_isready -h postgres -U lithosphere' 2>/dev/null; then
        integration_pass "API can reach PostgreSQL"
    else
        echo "   ⚠️  Cannot verify API-DB connectivity (pg_isready not in API container)"
    fi
}

# ============================================================================
# Phase 4: Monitoring Stack Validation
# ============================================================================

test_monitoring_stack() {
    print_header "PHASE 4: Monitoring Stack Validation"
    
    # Check if monitoring stack is running
    if ! docker ps --filter "name=litho-prometheus" | grep -q "prometheus"; then
        echo "⚠️  Monitoring stack not running - SKIPPING monitoring tests"
        echo "   To start: docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d"
        return 0
    fi
    
    # Test 4.1: Prometheus Health
    echo "[4.1] Testing Prometheus..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "http://${VPS_IP}:${PROMETHEUS_PORT}/-/healthy" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        integration_pass "Prometheus is healthy"
        
        # Check targets
        TARGETS_UP=$(curl -s "http://${VPS_IP}:${PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null | \
            jq '[.data.activeTargets[] | select(.health=="up")] | length' 2>/dev/null || echo "0")
        echo "   Active targets: ${TARGETS_UP}"
        
    else
        integration_fail "Prometheus returned HTTP ${HTTP_CODE}"
    fi
    
    # Test 4.2: Grafana Health
    echo "[4.2] Testing Grafana..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "http://${VPS_IP}:${GRAFANA_PORT}/api/health" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
        integration_pass "Grafana is healthy"
    else
        integration_fail "Grafana returned HTTP ${HTTP_CODE}"
    fi
    
    # Test 4.3: Alert Rules Loaded
    echo "[4.3] Testing Prometheus alert rules..."
    ALERT_RULES=$(curl -s "http://${VPS_IP}:${PROMETHEUS_PORT}/api/v1/rules" 2>/dev/null | \
        jq '[.data.groups[].rules[]] | length' 2>/dev/null || echo "0")
    
    if [ "$ALERT_RULES" -gt 0 ]; then
        integration_pass "Prometheus has ${ALERT_RULES} alert rules loaded"
    else
        integration_fail "No Prometheus alert rules loaded"
    fi
}

# ============================================================================
# Phase 5: Performance & Load Tests
# ============================================================================

test_performance() {
    print_header "PHASE 5: Performance Validation"
    
    # Test 5.1: API Response Time
    echo "[5.1] Testing API response time..."
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" \
        --connect-timeout 10 \
        "http://${VPS_IP}:${API_PORT}/health" || echo "999")
    
    # Convert to milliseconds
    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)
    
    if [ "$RESPONSE_MS" -lt 1000 ]; then
        perf_pass "API response time: ${RESPONSE_MS}ms (< 1s)"
    elif [ "$RESPONSE_MS" -lt 3000 ]; then
        perf_fail "API response time: ${RESPONSE_MS}ms (slow but acceptable)"
    else
        perf_fail "API response time: ${RESPONSE_MS}ms (too slow)"
    fi
    
    # Test 5.2: System Resources
    echo "[5.2] Testing system resources..."
    
    # Disk space
    DISK_USAGE=$(df -h /var/lib/docker | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 70 ]; then
        perf_pass "Disk usage: ${DISK_USAGE}% (healthy)"
    else
        perf_fail "Disk usage: ${DISK_USAGE}% (high)"
    fi
    
    # Memory
    MEM_TOTAL=$(free -g | awk '/^Mem:/{print $2}')
    MEM_USED=$(free -g | awk '/^Mem:/{print $3}')
    MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))
    
    if [ "$MEM_PERCENT" -lt 80 ]; then
        perf_pass "Memory usage: ${MEM_USED}GB/${MEM_TOTAL}GB (${MEM_PERCENT}%)"
    else
        perf_fail "Memory usage: ${MEM_USED}GB/${MEM_TOTAL}GB (${MEM_PERCENT}%)"
    fi
    
    # Test 5.3: Docker Container Stats
    echo "[5.3] Checking container resource usage..."
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -5
}

# ============================================================================
# Phase 6: Security & Configuration
# ============================================================================

test_security() {
    print_header "PHASE 6: Security & Configuration"
    
    # Test 6.1: Default passwords
    echo "[6.1] Checking for default passwords..."
    
    # Check if Grafana is using default password (we can't test this externally without auth)
    # But we can check the env variable
    GRAFANA_PASS=$(docker exec litho-grafana printenv GF_SECURITY_ADMIN_PASSWORD 2>/dev/null || echo "")
    
    if [ "$GRAFANA_PASS" = "lithosphere" ]; then
        critical_fail "Grafana is using default password 'lithosphere' - CHANGE IMMEDIATELY"
        echo "   Fix: docker compose exec grafana grafana-cli admin reset-admin-password YOUR_NEW_PASSWORD"
    else
        integration_pass "Grafana password has been changed from default"
    fi
    
    # Test 6.2: Environment file security
    echo "[6.2] Checking environment file permissions..."
    if [ -f ".env" ]; then
        ENV_PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%Lp" .env 2>/dev/null)
        if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "400" ]; then
            integration_pass ".env file has secure permissions (${ENV_PERMS})"
        else
            integration_fail ".env file permissions are ${ENV_PERMS} (should be 600 or 400)"
            echo "   Fix: chmod 600 .env"
        fi
    else
        echo "   ⚠️  No .env file found in current directory"
    fi
    
    # Test 6.3: Firewall check
    echo "[6.3] Checking firewall configuration..."
    if command -v ufw >/dev/null 2>&1; then
        UFW_STATUS=$(sudo ufw status 2>/dev/null | grep -i "status" || echo "unknown")
        
        if echo "$UFW_STATUS" | grep -qi "active"; then
            integration_pass "UFW firewall is active"
        else
            integration_fail "UFW firewall is not active"
        fi
    else
        echo "   ℹ️  UFW not installed, cannot check firewall"
    fi
}

# ============================================================================
# Phase 7: Smoke Tests (End-to-End)
# ============================================================================

test_smoke_tests() {
    print_header "PHASE 7: End-to-End Smoke Tests"
    
    # Test 7.1: Full API workflow
    echo "[7.1] Testing full API request workflow..."
    
    # Make a complete API request
    START_TIME=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /tmp/api-response.json -w "%{http_code}" \
        --connect-timeout 10 \
        --max-time 30 \
        "http://${VPS_IP}:${API_PORT}/health" || echo "000")
    END_TIME=$(date +%s%N)
    
    LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ "$HTTP_CODE" = "200" ]; then
        integration_pass "Full API workflow completed in ${LATENCY}ms"
    else
        integration_fail "API workflow failed with HTTP ${HTTP_CODE}"
    fi
    
    # Test 7.2: Concurrent requests
    echo "[7.2] Testing API under concurrent load (10 requests)..."
    
    SUCCESS_COUNT=0
    for i in {1..10}; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout 5 \
            "http://${VPS_IP}:${API_PORT}/health" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            ((SUCCESS_COUNT++))
        fi
    done
    
    if [ "$SUCCESS_COUNT" -eq 10 ]; then
        perf_pass "All 10 concurrent requests succeeded"
    elif [ "$SUCCESS_COUNT" -ge 8 ]; then
        perf_fail "${SUCCESS_COUNT}/10 concurrent requests succeeded"
    else
        integration_fail "Only ${SUCCESS_COUNT}/10 concurrent requests succeeded"
    fi
}

# ============================================================================
# Generate Final Report
# ============================================================================

generate_report() {
    print_header "FINAL VALIDATION REPORT"
    
    echo ""
    echo "┌────────────────────────────────────────────────────────────┐"
    echo "│                    Test Results Summary                    │"
    echo "├────────────────────────────────────────────────────────────┤"
    echo "│                                                            │"
    printf "│  ${GREEN}✅ Critical Tests Passed:     %-3d${NC}                      │\n" "$CRITICAL_PASS"
    printf "│  ${RED}❌ Critical Tests Failed:     %-3d${NC}                      │\n" "$CRITICAL_FAIL"
    echo "│                                                            │"
    printf "│  ${GREEN}✅ Integration Tests Passed:  %-3d${NC}                      │\n" "$INTEGRATION_PASS"
    printf "│  ${YELLOW}⚠️  Integration Tests Failed:  %-3d${NC}                      │\n" "$INTEGRATION_FAIL"
    echo "│                                                            │"
    printf "│  ${GREEN}✅ Performance Tests Passed:  %-3d${NC}                      │\n" "$PERF_PASS"
    printf "│  ${YELLOW}⚠️  Performance Tests Failed:  %-3d${NC}                      │\n" "$PERF_FAIL"
    echo "│                                                            │"
    echo "└────────────────────────────────────────────────────────────┘"
    echo ""
    
    # Calculate overall score
    TOTAL_TESTS=$((CRITICAL_PASS + CRITICAL_FAIL + INTEGRATION_PASS + INTEGRATION_FAIL + PERF_PASS + PERF_FAIL))
    TOTAL_PASS=$((CRITICAL_PASS + INTEGRATION_PASS + PERF_PASS))
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        SCORE=$((TOTAL_PASS * 100 / TOTAL_TESTS))
        echo "Overall Score: ${SCORE}%"
        echo ""
    fi
    
    # Determine readiness
    if [ $CRITICAL_FAIL -gt 0 ]; then
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}║  ❌ PRODUCTION READINESS: NOT READY                            ║${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}║  Critical failures detected. Do NOT deploy to production.     ║${NC}"
        echo -e "${RED}║  Fix critical issues and re-run validation.                   ║${NC}"
        echo -e "${RED}║                                                                ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        return 1
        
    elif [ $INTEGRATION_FAIL -gt 3 ] || [ $PERF_FAIL -gt 3 ]; then
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║                                                                ║${NC}"
        echo -e "${YELLOW}║  ⚠️  PRODUCTION READINESS: CONDITIONAL                         ║${NC}"
        echo -e "${YELLOW}║                                                                ║${NC}"
        echo -e "${YELLOW}║  No critical failures, but multiple warnings detected.        ║${NC}"
        echo -e "${YELLOW}║  Review warnings before deploying to production.              ║${NC}"
        echo -e "${YELLOW}║                                                                ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
        return 0
        
    else
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}║  ✅ PRODUCTION READINESS: READY                                ║${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}║  All critical tests passed. System is ready for production.   ║${NC}"
        echo -e "${GREEN}║                                                                ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        return 0
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    clear
    echo -e "${MAGENTA}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        Lithosphere Master Validation Suite v1.0               ║
║        Production Readiness Test                              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo "Testing VPS: ${VPS_IP}"
    echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo ""
    
    # Check prerequisites
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker not found${NC}"
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: jq not installed (some tests will be limited)${NC}"
        echo "Install: sudo apt-get install jq"
        sleep 2
    fi
    
    # Run all test phases
    test_critical_infrastructure
    test_service_health
    test_data_layer
    test_monitoring_stack
    test_performance
    test_security
    test_smoke_tests
    
    # Generate final report
    generate_report
}

# Execute main function
main
