#!/bin/bash

# ============================================================================
# Lithosphere VPS Connectivity Test Script
# Tests internal service communication and firewall configuration
# ============================================================================
# Usage:
#   chmod +x scripts/connectivity-test.sh
#   ./scripts/connectivity-test.sh
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
WARNINGS=0

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  $1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

test_pass() {
    echo -e "${GREEN}✅ PASS${NC} - $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}❌ FAIL${NC} - $1"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC} - $1"
    ((WARNINGS++))
}

# ============================================================================
# Test 1: Docker Network Connectivity
# ============================================================================

test_docker_network() {
    print_header "TEST 1: Docker Network Connectivity"
    
    # Check if litho-network exists
    if docker network inspect lithosphere_litho-network >/dev/null 2>&1; then
        test_pass "Docker network 'lithosphere_litho-network' exists"
        
        # Get network subnet
        SUBNET=$(docker network inspect lithosphere_litho-network | jq -r '.[0].IPAM.Config[0].Subnet')
        echo "   Network Subnet: $SUBNET"
    else
        test_fail "Docker network 'lithosphere_litho-network' not found"
        return 1
    fi
    
    # Check if services are on the network
    SERVICES=("litho-api" "litho-indexer" "litho-postgres" "litho-redis")
    
    for service in "${SERVICES[@]}"; do
        if docker ps --filter "name=${service}" --filter "status=running" | grep -q "${service}"; then
            NETWORK_CHECK=$(docker inspect "${service}" | jq -r '.[0].NetworkSettings.Networks["lithosphere_litho-network"]')
            
            if [ "$NETWORK_CHECK" != "null" ]; then
                IP=$(docker inspect "${service}" | jq -r '.[0].NetworkSettings.Networks["lithosphere_litho-network"].IPAddress')
                test_pass "Service '${service}' connected to network (IP: ${IP})"
            else
                test_fail "Service '${service}' NOT on lithosphere_litho-network"
            fi
        else
            test_warn "Service '${service}' not running"
        fi
    done
}

# ============================================================================
# Test 2: Internal Service Health Checks
# ============================================================================

test_internal_health() {
    print_header "TEST 2: Internal Service Health Checks"
    
    # Test API health from inside network
    echo "Testing API health endpoint (internal)..."
    if docker exec litho-api wget -q --spider http://localhost:4000/health 2>/dev/null; then
        API_RESPONSE=$(docker exec litho-api wget -q -O- http://localhost:4000/health 2>/dev/null)
        echo "   Response: $API_RESPONSE"
        test_pass "API /health endpoint responding"
    else
        test_fail "API /health endpoint not responding"
    fi
    
    # Test Indexer health from inside network
    echo "Testing Indexer health endpoint (internal)..."
    if docker exec litho-indexer wget -q --spider http://localhost:3001/health 2>/dev/null; then
        INDEXER_RESPONSE=$(docker exec litho-indexer wget -q -O- http://localhost:3001/health 2>/dev/null)
        echo "   Response: $INDEXER_RESPONSE"
        test_pass "Indexer /health endpoint responding"
    else
        test_fail "Indexer /health endpoint not responding"
    fi
}

# ============================================================================
# Test 3: Database Connectivity
# ============================================================================

test_database_connectivity() {
    print_header "TEST 3: Database Connectivity"
    
    # Test PostgreSQL from API container
    echo "Testing PostgreSQL connection from API container..."
    if docker exec litho-api sh -c 'command -v pg_isready >/dev/null 2>&1'; then
        if docker exec litho-api pg_isready -h postgres -U lithosphere 2>/dev/null; then
            test_pass "API can connect to PostgreSQL"
        else
            test_fail "API cannot connect to PostgreSQL"
        fi
    else
        # Alternative test using psql
        DB_TEST=$(docker exec litho-postgres psql -U lithosphere -d lithosphere -c "SELECT 1;" 2>/dev/null | grep -c "1 row" || echo "0")
        if [ "$DB_TEST" = "1" ]; then
            test_pass "PostgreSQL is operational"
        else
            test_fail "PostgreSQL connection test failed"
        fi
    fi
    
    # Test Redis from API container
    echo "Testing Redis connection from API container..."
    if docker exec litho-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        test_pass "Redis is responding to PING"
        
        # Test from API container perspective
        if docker exec litho-api sh -c 'command -v redis-cli >/dev/null 2>&1'; then
            if docker exec litho-api redis-cli -h redis ping 2>/dev/null | grep -q "PONG"; then
                test_pass "API can connect to Redis"
            else
                test_warn "API cannot reach Redis (redis-cli not available in API container)"
            fi
        else
            test_warn "redis-cli not installed in API container (cannot test from API)"
        fi
    else
        test_fail "Redis not responding"
    fi
}

# ============================================================================
# Test 4: Inter-Service Communication
# ============================================================================

test_inter_service_communication() {
    print_header "TEST 4: Inter-Service Communication"
    
    # Test API->Database DNS resolution
    echo "Testing DNS resolution: API -> postgres..."
    if docker exec litho-api sh -c 'command -v nslookup >/dev/null 2>&1' || docker exec litho-api sh -c 'command -v ping >/dev/null 2>&1'; then
        if docker exec litho-api ping -c 1 postgres >/dev/null 2>&1; then
            test_pass "API can resolve 'postgres' hostname"
        else
            test_warn "Cannot ping postgres (ICMP might be disabled in container)"
        fi
    else
        test_warn "Cannot test DNS resolution (no nslookup/ping in container)"
    fi
    
    # Test API->Redis DNS resolution
    echo "Testing DNS resolution: API -> redis..."
    if docker exec litho-api sh -c 'command -v ping >/dev/null 2>&1'; then
        if docker exec litho-api ping -c 1 redis >/dev/null 2>&1; then
            test_pass "API can resolve 'redis' hostname"
        else
            test_warn "Cannot ping redis (ICMP might be disabled in container)"
        fi
    fi
    
    # Test Prometheus->API connectivity (if monitoring stack is running)
    if docker ps --filter "name=litho-prometheus" | grep -q "litho-prometheus"; then
        echo "Testing Prometheus scrape connectivity..."
        
        # Check if Prometheus can reach API metrics endpoint
        PROM_TARGETS=$(docker exec litho-prometheus wget -q -O- http://localhost:9090/api/v1/targets 2>/dev/null)
        
        if echo "$PROM_TARGETS" | grep -q '"job":"litho-api"'; then
            if echo "$PROM_TARGETS" | grep -q '"health":"up"'; then
                test_pass "Prometheus successfully scraping API metrics"
            else
                test_fail "Prometheus cannot scrape API metrics (target down)"
            fi
        else
            test_warn "Prometheus API target not configured"
        fi
    else
        test_warn "Monitoring stack not running (skipping Prometheus tests)"
    fi
}

# ============================================================================
# Test 5: External Firewall & Port Accessibility
# ============================================================================

test_firewall_config() {
    print_header "TEST 5: Firewall & External Port Accessibility"
    
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo "Server IP: $SERVER_IP"
    
    # Test publicly accessible ports
    REQUIRED_PORTS=(
        "4000:API"
        "3000:Grafana"
        "9091:Prometheus"
    )
    
    for port_desc in "${REQUIRED_PORTS[@]}"; do
        IFS=':' read -r port service <<< "$port_desc"
        
        echo "Testing external access to ${service} on port ${port}..."
        
        # Use curl to test if localhost can access
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:${port} >/dev/null 2>&1; then
            test_pass "Port ${port} (${service}) is accessible from localhost"
        else
            test_warn "Port ${port} (${service}) may not be accessible externally"
        fi
    done
    
    # Check firewall status
    echo ""
    echo "Firewall Status:"
    if command -v ufw >/dev/null 2>&1; then
        UFW_STATUS=$(sudo ufw status 2>/dev/null || echo "Cannot check UFW (need sudo)")
        echo "$UFW_STATUS"
        
        if echo "$UFW_STATUS" | grep -q "Status: active"; then
            if echo "$UFW_STATUS" | grep -q "4000"; then
                test_pass "UFW rule exists for API port 4000"
            else
                test_warn "UFW rule missing for API port 4000"
                echo "   Fix: sudo ufw allow 4000/tcp"
            fi
        else
            test_warn "UFW firewall is inactive"
        fi
    else
        echo "   UFW not installed, checking iptables..."
        
        if command -v iptables >/dev/null 2>&1; then
            IPTABLES_RULES=$(sudo iptables -L INPUT -n 2>/dev/null || echo "Cannot check iptables")
            if echo "$IPTABLES_RULES" | grep -q "4000"; then
                test_pass "iptables rule exists for port 4000"
            else
                test_warn "No explicit iptables rule for port 4000"
            fi
        else
            test_warn "Cannot check firewall configuration"
        fi
    fi
}

# ============================================================================
# Test 6: Resource Availability
# ============================================================================

test_resource_availability() {
    print_header "TEST 6: System Resource Availability"
    
    # Check disk space
    DISK_USAGE=$(df -h /var/lib/docker | tail -1 | awk '{print $5}' | sed 's/%//')
    echo "Docker disk usage: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -lt 70 ]; then
        test_pass "Disk usage is acceptable (${DISK_USAGE}%)"
    elif [ "$DISK_USAGE" -lt 85 ]; then
        test_warn "Disk usage is high (${DISK_USAGE}%) - consider cleanup"
    else
        test_fail "Disk usage is critical (${DISK_USAGE}%) - immediate cleanup required"
    fi
    
    # Check memory
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    USED_MEM=$(free -g | awk '/^Mem:/{print $3}')
    MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))
    
    echo "Memory usage: ${USED_MEM}GB / ${TOTAL_MEM}GB (${MEM_PERCENT}%)"
    
    if [ "$MEM_PERCENT" -lt 80 ]; then
        test_pass "Memory usage is acceptable (${MEM_PERCENT}%)"
    else
        test_warn "Memory usage is high (${MEM_PERCENT}%)"
    fi
    
    # Check CPU load
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    CPU_COUNT=$(nproc)
    echo "Load average: ${LOAD_AVG} (${CPU_COUNT} CPUs)"
    
    # Convert load to integer for comparison (multiply by 100)
    LOAD_INT=$(echo "$LOAD_AVG * 100" | bc | cut -d. -f1)
    THRESHOLD=$((CPU_COUNT * 100))
    
    if [ "$LOAD_INT" -lt "$THRESHOLD" ]; then
        test_pass "CPU load is normal (${LOAD_AVG})"
    else
        test_warn "CPU load is high (${LOAD_AVG})"
    fi
}

# ============================================================================
# Test 7: Container Health Status
# ============================================================================

test_container_health() {
    print_header "TEST 7: Container Health Status"
    
    echo "Container Status:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}" || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Health}}"
    echo ""
    
    CONTAINERS=("litho-api" "litho-indexer" "litho-postgres" "litho-redis")
    
    for container in "${CONTAINERS[@]}"; do
        if docker ps --filter "name=${container}" --format "{{.Names}}" | grep -q "${container}"; then
            STATUS=$(docker inspect --format='{{.State.Status}}' "${container}")
            HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "no-healthcheck")
            
            if [ "$STATUS" = "running" ]; then
                if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "no-healthcheck" ]; then
                    test_pass "Container '${container}' is running and healthy"
                else
                    test_warn "Container '${container}' is running but health=$HEALTH"
                fi
            else
                test_fail "Container '${container}' status=$STATUS"
            fi
        else
            test_fail "Container '${container}' not found"
        fi
    done
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    clear
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║       Lithosphere VPS Connectivity & Health Test Suite        ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check if docker is available
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
        exit 1
    fi
    
    # Check if running with appropriate permissions
    if ! docker ps >/dev/null 2>&1; then
        echo -e "${RED}Error: Cannot access Docker. Run with sudo or add user to docker group.${NC}"
        exit 1
    fi
    
    # Run all tests
    test_docker_network
    test_internal_health
    test_database_connectivity
    test_inter_service_communication
    test_firewall_config
    test_resource_availability
    test_container_health
    
    # Print summary
    print_header "TEST SUMMARY"
    
    echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
    echo -e "${YELLOW}⚠️  Warnings: ${WARNINGS}${NC}"
    echo -e "${RED}❌ Failed: ${FAILED}${NC}"
    echo ""
    
    TOTAL=$((PASSED + FAILED))
    if [ $TOTAL -gt 0 ]; then
        SUCCESS_RATE=$((PASSED * 100 / TOTAL))
        echo "Success Rate: ${SUCCESS_RATE}%"
    fi
    
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✅ ALL CRITICAL TESTS PASSED - SYSTEM HEALTHY                ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ❌ SOME TESTS FAILED - REVIEW ISSUES ABOVE                    ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        exit 1
    fi
}

# Run main function
main
