# Lithosphere Infrastructure Configuration

This directory contains all infrastructure-related configuration files for the Lithosphere Makulu deployment.

## Directory Structure

```
infra/
├── alertmanager/          # Alertmanager configuration
│   └── alertmanager-config.yaml
│
├── grafana/               # Grafana provisioning & dashboards
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yaml
│   │   └── dashboards/
│   │       └── dashboards.yaml
│   └── dashboards/
│       ├── system-overview.json
│       ├── api-monitoring.json
│       └── container-metrics.json
│
├── k8s/                   # Kubernetes manifests (future)
│   └── base/
│       └── kustomization.yaml
│
├── loki/                  # Loki log aggregation
│   └── loki-config.yaml
│
├── postgres/              # PostgreSQL initialization
│   └── init.sql
│
├── prometheus/            # Prometheus metrics & alerts
│   ├── prometheus.yml
│   └── alerts/
│       └── lithosphere-alerts.yml
│
└── promtail/              # Promtail log collection
    └── promtail-config.yaml
```

## Configuration Files

### Alertmanager

**File**: `alertmanager/alertmanager-config.yaml`

Handles alert routing and notifications. Currently configured with console output.

**To enable Slack notifications:**
1. Create a Slack webhook URL
2. Uncomment the `slack_configs` section
3. Add your webhook URL
4. Restart Alertmanager

**To enable email notifications:**
1. Configure SMTP settings in the `global` section
2. Uncomment email receivers
3. Restart Alertmanager

### Grafana

**Provisioning**: `grafana/provisioning/`
- Automatically configures datasources (Prometheus, Loki)
- Loads dashboards from `grafana/dashboards/`

**Pre-configured Dashboards**:
1. **System Overview** - VPS health (CPU, RAM, Disk, Network)
2. **API Monitoring** - Request rates, latencies, errors, logs
3. **Container Metrics** - Docker container resource usage

**Custom Dashboards**:
- Create JSON files in `grafana/dashboards/`
- They will be auto-loaded on Grafana restart

### Loki

**File**: `loki/loki-config.yaml`

Log aggregation and storage configuration.

**Key Settings**:
- **Retention**: 30 days (720 hours)
- **Max ingestion rate**: 4 MB/s
- **Storage**: Filesystem (`/loki`)

**To adjust retention**:
```yaml
limits_config:
  retention_period: 360h  # 15 days instead of 30
```

### Prometheus

**File**: `prometheus/prometheus.yml`

Metrics collection and scrape configuration.

**Monitored Targets**:
- Lithosphere API (port 9090)
- Lithosphere Indexer (port 9090)
- Node Exporter (port 9100) - VPS metrics
- cAdvisor (port 8080) - Container metrics
- Docker containers with `prometheus.scrape=true` label

**Alert Rules**: `prometheus/alerts/lithosphere-alerts.yml`

Defines alert conditions for:
- Service health (API down, Indexer down, DB down)
- Performance issues (high latency, error rates)
- Resource usage (CPU, memory, disk)
- Container issues (restarts, high resource usage)

**To add custom alerts**:
1. Edit `lithosphere-alerts.yml`
2. Follow Prometheus alert syntax
3. Reload Prometheus: `curl -X POST http://localhost:9091/-/reload`

### Promtail

**File**: `promtail/promtail-config.yaml`

Log collection agent that ships logs to Loki.

**Log Sources**:
- Docker container logs (`/var/lib/docker/containers`)
- System logs (`/var/log/syslog`)
- Auto-discovered containers with monitoring labels

**Pipeline**:
1. Collects logs from sources
2. Parses JSON logs
3. Extracts labels (service, environment, level)
4. Ships to Loki

### PostgreSQL

**File**: `postgres/init.sql`

Database initialization script.

**Creates**:
- Required extensions (uuid-ossp, pg_trgm)
- `transfers` table for LEP-100 events
- `blocks` table for block metadata
- Indexes for query optimization

### Kubernetes (Future)

**Directory**: `k8s/`

Placeholder for Kubernetes manifests when deploying to K8s clusters.

---

## Environment Variables

Many configurations can be overridden with environment variables:

```bash
# Grafana
GRAFANA_PORT=3001
GRAFANA_USER=admin
GRAFANA_PASSWORD=lithosphere

# Prometheus
PROMETHEUS_PORT=9091

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# API
API_PORT=4000
LITHO_RPC_URL=https://testnet-rpc.lithosphere.network
LITHO_CHAIN_ID=61
```

Set these in `.env` file or export them before running Docker Compose.

---

## Maintenance

### Updating Configurations

After modifying any config file:

```bash
# For Prometheus (supports hot-reload)
curl -X POST http://localhost:9091/-/reload

# For other services, restart the specific container
docker compose restart SERVICE_NAME

# Or restart the entire monitoring stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml restart
```

### Backup Configurations

```bash
# Backup all configs
tar czf infra-backup-$(date +%Y%m%d).tar.gz infra/

# Restore from backup
tar xzf infra-backup-YYYYMMDD.tar.gz
```

### Volume Management

Monitoring data is stored in Docker volumes:

```bash
# List volumes
docker volume ls | grep lithosphere

# Inspect a volume
docker volume inspect lithosphere_prometheus-data

# Backup a volume
docker run --rm -v lithosphere_prometheus-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-data.tar.gz /data

# Restore a volume
docker run --rm -v lithosphere_prometheus-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/prometheus-data.tar.gz -C /
```

---

## Security Considerations

### 1. Network Exposure

By default, monitoring services are exposed on all interfaces. In production:

**Option A**: Use firewall rules
```bash
# Allow only from specific IP
ufw allow from YOUR_IP to any port 3001  # Grafana
ufw allow from YOUR_IP to any port 9091  # Prometheus
```

**Option B**: Bind to localhost only
```yaml
# In docker-compose.monitoring.yaml
prometheus:
  ports:
    - "127.0.0.1:9091:9090"  # Only accessible locally
```

### 2. Grafana Authentication

Change default password immediately:

```bash
# Via Grafana UI: User → Change Password

# Or via Docker CLI:
docker compose exec grafana grafana-cli admin reset-admin-password NEW_PASSWORD
```

### 3. Alertmanager Secrets

Never commit credentials to version control:

```yaml
# Use environment variables
global:
  smtp_auth_password: ${SMTP_PASSWORD}

# Or use Docker secrets (Swarm mode)
secrets:
  smtp_password:
    external: true
```

---

## Troubleshooting

### Issue: Configuration not loading

```bash
# Check config syntax
docker compose config

# View container logs
docker compose logs SERVICE_NAME

# Validate specific configs
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Issue: Dashboards not appearing in Grafana

1. Check provisioning path is correct
2. Verify JSON syntax: `jq . dashboard.json`
3. Check Grafana logs: `docker compose logs grafana`
4. Restart Grafana: `docker compose restart grafana`

### Issue: Alerts not firing

1. Check alert rule syntax in Prometheus UI
2. Verify Alertmanager is configured in `prometheus.yml`
3. Test alert: `curl http://localhost:9091/api/v1/rules`
4. Check Alertmanager: `curl http://localhost:9093/api/v2/alerts`

---

## Performance Tuning

### Reduce Disk Usage

```yaml
# Prometheus - Reduce retention
prometheus:
  command:
    - '--storage.tsdb.retention.time=7d'

# Loki - Reduce retention
# Edit loki-config.yaml
limits_config:
  retention_period: 168h  # 7 days
```

### Reduce Memory Usage

```yaml
# Limit container memory
prometheus:
  deploy:
    resources:
      limits:
        memory: 512M

loki:
  deploy:
    resources:
      limits:
        memory: 256M
```

### Optimize Scrape Intervals

```yaml
# Prometheus - Increase scrape interval
global:
  scrape_interval: 30s  # From 15s

# Or per-job
scrape_configs:
  - job_name: 'litho-indexer'
    scrape_interval: 60s  # Less critical service
```

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Alertmanager Guide](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL Guide](https://grafana.com/docs/loki/latest/query/)
