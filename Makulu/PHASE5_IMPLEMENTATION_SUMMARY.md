# Phase 5 Implementation Summary

## Overview

**Phase 5: Observability & Logging** has been successfully implemented for the Lithosphere Makulu Testnet deployment. This phase provides comprehensive monitoring, logging, and alerting capabilities for all services running on the VPS.

---

## What Was Implemented

### 1. ✅ Centralized Logging Solution

**Components:**
- **Loki** (v2.9.3) - Lightweight log aggregation and storage
- **Promtail** (v2.9.3) - Log collection agent for Docker containers

**Features:**
- Automatic log collection from all Docker containers
- 30-day log retention
- JSON log parsing and labeling
- System log collection from `/var/log/syslog`
- Integration with Grafana for log visualization

**Configuration Files:**
- `infra/loki/loki-config.yaml`
- `infra/promtail/promtail-config.yaml`

---

### 2. ✅ Resource Monitoring Stack

**Components:**
- **Prometheus** (v2.48.1) - Metrics collection and time-series database
- **Node Exporter** (v1.7.0) - VPS system metrics (CPU, RAM, Disk, Network)
- **cAdvisor** (v0.47.2) - Docker container metrics

**Features:**
- 30-day metrics retention
- 15-second scrape interval for critical services
- Auto-discovery of Docker containers with Prometheus labels
- Custom alert rules for service health and resource usage

**Configuration Files:**
- `infra/prometheus/prometheus.yml` - Main configuration
- `infra/prometheus/alerts/lithosphere-alerts.yml` - Alert rules

**Monitored Metrics:**
- VPS: CPU usage, Memory usage, Disk usage, Network I/O
- Containers: CPU, Memory, Network, Restart count
- Services: API request rate, latency, error rate, uptime

---

### 3. ✅ Grafana Dashboards

**Component:**
- **Grafana** (v10.2.3) - Data visualization and dashboards

**Pre-configured Dashboards:**

1. **System Overview** (`system-overview.json`)
   - Real-time VPS CPU usage
   - Memory consumption
   - Disk space utilization
   - Service health status (API, Indexer, PostgreSQL)

2. **API Monitoring** (`api-monitoring.json`)
   - Request rate (requests/sec)
   - Response time percentiles (p50, p95, p99)
   - Error rates (4xx, 5xx)
   - Real-time API logs

3. **Container Metrics** (`container-metrics.json`)
   - Per-container CPU usage
   - Memory consumption by container
   - Network I/O statistics
   - Container restart tracking

**Access:**
- URL: `http://YOUR_VPS_IP:3001`
- Default credentials: `admin` / `lithosphere`

**Configuration Files:**
- `infra/grafana/provisioning/datasources/datasources.yaml`
- `infra/grafana/provisioning/dashboards/dashboards.yaml`
- `infra/grafana/dashboards/*.json`

---

### 4. ✅ Alerting System

**Components:**
- **Alertmanager** (v0.26.0) - Alert routing and notification management
- **GitHub Actions** - Automated health monitoring

**Alert Rules:**

| Alert Name | Condition | Severity | Duration |
|------------|-----------|----------|----------|
| APIDown | API service unreachable | Critical | 2 minutes |
| IndexerDown | Indexer service unreachable | Critical | 2 minutes |
| PostgreSQLDown | Database unreachable | Critical | 1 minute |
| HighCPUUsage | CPU usage > 80% | Warning | 5 minutes |
| HighMemoryUsage | Memory usage > 85% | Warning | 5 minutes |
| DiskSpaceLow | Disk usage > 80% | Warning | 5 minutes |
| DiskSpaceCritical | Disk usage > 90% | Critical | 2 minutes |
| HighAPIErrorRate | 5xx errors > 5% | Warning | 5 minutes |
| ContainerRestarted | Restarts > 3 in 1 hour | Warning | 1 minute |

**GitHub Action: Health Monitoring**
- **File**: `.github/workflows/health-monitoring.yaml`
- **Frequency**: Every 5 minutes (cron schedule)
- **Checks**: API health, GraphQL endpoint, Prometheus, Grafana
- **Actions on Failure**:
  - Creates GitHub issue with "deployment-failure" label
  - Sends Slack notification (if webhook configured)
  - Generates detailed health report

**Configuration Files:**
- `infra/alertmanager/alertmanager-config.yaml`

---

### 5. ✅ Enhanced Health Checks

**Updates to `docker-compose.yaml`:**
- Added structured logging configuration to API and Indexer services
- Enhanced healthcheck parameters
- Added Prometheus scrape labels
- Configured log rotation (10MB max, 3 files)

**Services with Health Checks:**
- ✅ API - `/health` endpoint (30s interval)
- ✅ Indexer - `/health` endpoint (60s interval)
- ✅ PostgreSQL - `pg_isready` check (10s interval)
- ✅ Redis - `redis-cli ping` check (10s interval)
- ✅ Prometheus - `/-/healthy` endpoint (30s interval)
- ✅ Grafana - `/api/health` endpoint (30s interval)
- ✅ Loki - `/ready` endpoint (30s interval)

---

## File Structure

```
Makulu/
├── docker-compose.yaml                    # Enhanced with logging & labels
├── docker-compose.monitoring.yaml         # NEW - Monitoring stack
├── PHASE5_OBSERVABILITY_GUIDE.md         # NEW - Complete documentation
│
├── .github/workflows/
│   └── health-monitoring.yaml            # NEW - Automated health checks
│
├── infra/
│   ├── README.md                         # NEW - Infrastructure docs
│   │
│   ├── alertmanager/
│   │   └── alertmanager-config.yaml      # NEW - Alert routing
│   │
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── datasources.yaml      # NEW - Prometheus + Loki
│   │   │   └── dashboards/
│   │   │       └── dashboards.yaml       # NEW - Dashboard config
│   │   └── dashboards/
│   │       ├── system-overview.json      # NEW
│   │       ├── api-monitoring.json       # NEW
│   │       └── container-metrics.json    # NEW
│   │
│   ├── loki/
│   │   └── loki-config.yaml             # NEW
│   │
│   ├── prometheus/
│   │   ├── prometheus.yml                # UPDATED - Added targets
│   │   └── alerts/
│   │       └── lithosphere-alerts.yml    # NEW
│   │
│   └── promtail/
│       └── promtail-config.yaml         # NEW
│
└── scripts/
    └── deploy-monitoring.sh              # NEW - Automated deployment
```

---

## Deployment Instructions

### Method 1: Automated Deployment (Recommended)

```bash
cd /opt/lithosphere/Makulu
chmod +x scripts/deploy-monitoring.sh
./scripts/deploy-monitoring.sh
```

Select option 1 for full stack deployment.

### Method 2: Manual Deployment

```bash
cd /opt/lithosphere/Makulu

# Create .env file
cp .env.testnet .env

# Deploy full stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d

# Check status
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml ps

# View logs
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml logs -f
```

---

## Accessing Services

After deployment, access the following URLs (replace `YOUR_VPS_IP`):

| Service | URL | Purpose |
|---------|-----|---------|
| **Grafana** | http://YOUR_VPS_IP:3001 | Dashboards & visualization |
| **Prometheus** | http://YOUR_VPS_IP:9091 | Metrics & alerts |
| **Alertmanager** | http://YOUR_VPS_IP:9093 | Alert management |
| **cAdvisor** | http://YOUR_VPS_IP:8080 | Container stats |
| **API** | http://YOUR_VPS_IP:4000 | Lithosphere API |
| **GraphQL** | http://YOUR_VPS_IP:4000/graphql | GraphQL endpoint |

---

## Resource Usage

The monitoring stack adds the following resource overhead:

| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Prometheus | ~0.5 cores | 512 MB | 10 GB |
| Loki | ~0.25 cores | 256 MB | 5 GB |
| Grafana | ~0.25 cores | 256 MB | 1 GB |
| Promtail | ~0.1 cores | 128 MB | - |
| Node Exporter | ~0.1 cores | 64 MB | - |
| cAdvisor | ~0.25 cores | 128 MB | - |
| Alertmanager | ~0.1 cores | 128 MB | 500 MB |
| **TOTAL** | **~1.5 cores** | **~1.5 GB** | **~17 GB** |

**Recommended VPS Specs:**
- CPU: 4+ cores (2 for apps + 2 for monitoring)
- RAM: 8+ GB (4 GB for apps + 4 GB for monitoring)
- Disk: 80+ GB SSD

---

## Configuration Options

### Enable Slack Notifications

1. Create a Slack webhook
2. Edit `infra/alertmanager/alertmanager-config.yaml`
3. Uncomment and configure the Slack receiver
4. Restart Alertmanager:
   ```bash
   docker compose restart alertmanager
   ```

### Enable Email Alerts

1. Edit `infra/alertmanager/alertmanager-config.yaml`
2. Configure SMTP settings in the `global` section
3. Uncomment email receivers
4. Restart Alertmanager

### Adjust Retention Periods

**Prometheus (default: 30 days):**
```yaml
# docker-compose.monitoring.yaml
prometheus:
  command:
    - '--storage.tsdb.retention.time=15d'
```

**Loki (default: 30 days):**
```yaml
# infra/loki/loki-config.yaml
limits_config:
  retention_period: 360h  # 15 days
```

---

## Testing & Verification

### 1. Verify Services Are Running

```bash
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml ps
```

All services should show "healthy" or "running" status.

### 2. Test Prometheus Metrics

```bash
# Check if Prometheus is scraping targets
curl http://localhost:9091/api/v1/targets | jq .

# Query API uptime
curl http://localhost:9091/api/v1/query?query=up{job="litho-api"}
```

### 3. Test Loki Logs

Access Grafana → Explore → Select Loki → Run query:
```logql
{job="lithosphere-api"}
```

### 4. Test Alerting

```bash
# Check active alerts
curl http://localhost:9091/api/v1/alerts

# View alert rules
curl http://localhost:9091/api/v1/rules
```

### 5. Trigger Test Alert

```bash
# Stop API to trigger alert
docker compose stop api

# Wait 2 minutes, then check
curl http://localhost:9091/api/v1/alerts

# Restart API
docker compose start api
```

---

## Maintenance Tasks

### Daily
- ✅ Check Grafana dashboards for anomalies
- ✅ Review alerts in Alertmanager

### Weekly
- ✅ Check disk space: `df -h`
- ✅ Review error logs in Loki
- ✅ Verify all services are healthy

### Monthly
- ✅ Update monitoring images
- ✅ Review and tune alert thresholds
- ✅ Backup Grafana dashboards
- ✅ Clean up old logs/metrics if needed

---

## Troubleshooting

### Issue: Grafana shows "No Data"

**Solution:**
1. Check datasources: Configuration → Data Sources
2. Test Prometheus connection
3. Verify time range in dashboard
4. Check if Prometheus is scraping: `curl http://localhost:9091/api/v1/targets`

### Issue: Logs not appearing in Loki

**Solution:**
```bash
# Check Promtail is running
docker compose logs promtail

# Verify Loki is accessible
curl http://localhost:3100/ready

# Check if promtail can access Docker socket
ls -la /var/run/docker.sock
```

### Issue: High disk usage

**Solution:**
```bash
# Check Docker disk usage
docker system df -v

# Clean up old data
docker system prune -a --volumes

# Reduce retention in configs (see Configuration Options)
```

---

## Security Recommendations

1. **Change Grafana password immediately:**
   ```bash
   docker compose exec grafana grafana-cli admin reset-admin-password NEW_PASSWORD
   ```

2. **Restrict monitoring port access:**
   ```bash
   # Allow only from your IP
   ufw allow from YOUR_IP to any port 3001
   ufw allow from YOUR_IP to any port 9091
   ```

3. **Use environment variables for secrets:**
   - Store credentials in `.env` file (already gitignored)
   - Never commit `.env` to version control

4. **Enable HTTPS for production:**
   - Use Traefik reverse proxy (already configured)
   - Or use Nginx with Let's Encrypt certificates

---

## Next Steps

1. ✅ Configure Slack/Email notifications
2. ✅ Set up firewall rules for monitoring ports
3. ✅ Create custom dashboards for specific needs
4. ✅ Integrate with PagerDuty for on-call alerts
5. ✅ Set up automated backups for Grafana dashboards
6. ✅ Fine-tune alert thresholds based on actual usage

---

## Documentation

- **Main Guide**: [PHASE5_OBSERVABILITY_GUIDE.md](./PHASE5_OBSERVABILITY_GUIDE.md)
- **Infrastructure Docs**: [infra/README.md](./infra/README.md)
- **Deployment Script**: [scripts/deploy-monitoring.sh](./scripts/deploy-monitoring.sh)
- **Health Check Script**: [scripts/health-check.sh](./scripts/health-check.sh)

---

## Support

For issues or questions:
- 📧 GitHub Issues: https://github.com/KaJLabs/lithosphere/issues
- 📖 Documentation: See files listed above
- 🔍 Check logs: `docker compose logs SERVICE_NAME`
- 📊 Review metrics: Check Grafana dashboards

---

**Phase 5 Implementation Complete! ✅**

The Lithosphere Makulu Testnet now has enterprise-grade observability and monitoring capabilities.
