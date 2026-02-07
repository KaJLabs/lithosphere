# Phase 5: Observability & Logging - Deployment Guide

## Overview

This guide covers the deployment and usage of the complete observability stack for Lithosphere Makulu Testnet, including:

- **Logging**: Loki + Promtail for centralized log aggregation
- **Metrics**: Prometheus + Node Exporter + cAdvisor for system and container metrics
- **Visualization**: Grafana with pre-configured dashboards
- **Alerting**: Alertmanager for alert routing and notifications
- **Health Monitoring**: Automated GitHub Action running every 5 minutes

---

## Quick Start

### 1. Deploy Monitoring Stack

```bash
# Navigate to Makulu directory
cd /opt/lithosphere/Makulu

# Start the base services
docker compose up -d

# Start the monitoring stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d

# Verify all services are running
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml ps
```

### 2. Access Dashboards

Once deployed, access the following services:

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| **Grafana** | http://YOUR_VPS_IP:3001 | admin / lithosphere |
| **Prometheus** | http://YOUR_VPS_IP:9091 | N/A |
| **Alertmanager** | http://YOUR_VPS_IP:9093 | N/A |
| **cAdvisor** | http://YOUR_VPS_IP:8080 | N/A |

### 3. View Pre-configured Dashboards

After logging into Grafana, navigate to:
- **Dashboards → Lithosphere → System Overview** - VPS health, CPU, memory, disk
- **Dashboards → Lithosphere → API Monitoring** - API performance, error rates, logs
- **Dashboards → Lithosphere → Container Metrics** - Docker container stats

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lithosphere Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   API    │  │ Indexer  │  │ Postgres │  │  Redis   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │      Promtail         │                       │
│              │   (Log Collector)     │                       │
│              └───────────┬───────────┘                       │
└──────────────────────────┼───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌────────┐         ┌────────┐       ┌──────────┐
   │  Loki  │         │ Prom   │       │   Node   │
   │ (Logs) │         │(Metrics)│      │ Exporter │
   └───┬────┘         └───┬────┘       └────┬─────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Grafana    │
                   │  (Dashboards)│
                   └──────────────┘
```

---

## Configuration Files

### Logging Configuration

#### Loki (`infra/loki/loki-config.yaml`)
- **Retention**: 30 days (720 hours)
- **Storage**: Local filesystem (`/loki`)
- **Max ingestion rate**: 4 MB/s

#### Promtail (`infra/promtail/promtail-config.yaml`)
- Scrapes Docker container logs from `/var/lib/docker/containers`
- Scrapes system logs from `/var/log/syslog`
- Auto-discovers containers with monitoring labels
- Parses JSON logs from services

### Metrics Configuration

#### Prometheus (`infra/prometheus/prometheus.yml`)
- **Scrape interval**: 15 seconds
- **Retention**: 30 days
- **Targets**: API, Indexer, Node Exporter, cAdvisor, Docker services
- **Alert rules**: Defined in `infra/prometheus/alerts/`

#### Alert Rules (`infra/prometheus/alerts/lithosphere-alerts.yml`)
- API health monitoring
- High CPU/memory/disk usage alerts
- Container restart detection
- Database connection alerts
- Indexer lag detection

### Alerting Configuration

#### Alertmanager (`infra/alertmanager/alertmanager-config.yaml`)
Currently configured with console output. To enable notifications:

**Slack Integration:**
```yaml
# Uncomment in alertmanager-config.yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#lithosphere-critical'
        api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
```

**Email Notifications:**
```yaml
# Uncomment in alertmanager-config.yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@lithosphere.network'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'
```

---

## Health Monitoring

### GitHub Action

A GitHub Action runs every 5 minutes to check:
- ✅ API health endpoint (`/health`)
- ✅ GraphQL endpoint (`/graphql`)
- ✅ Prometheus availability
- ✅ Grafana availability

**Configuration:** `.github/workflows/health-monitoring.yaml`

**Required Secrets:**
- `SERVER_IP` - Your VPS IP address
- `SLACK_WEBHOOK_URL` (optional) - For Slack notifications

### Manual Health Check

Run the health check script manually:

```bash
cd /opt/lithosphere/Makulu
./scripts/health-check.sh YOUR_VPS_IP 4000 9090
```

---

## Monitoring Best Practices

### 1. Check Logs

#### View all service logs:
```bash
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml logs -f
```

#### View specific service logs:
```bash
docker compose logs -f api
docker compose logs -f indexer
docker compose logs -f prometheus
```

#### Query logs in Loki (via Grafana):
1. Go to **Explore** → Select **Loki** datasource
2. Use LogQL queries:
   ```logql
   {job="lithosphere-api"} |= "error"
   {service="indexer"} | json | level="error"
   ```

### 2. Monitor Metrics

#### Check service health in Prometheus:
- Open http://YOUR_VPS_IP:9091
- Query: `up{job="litho-api"}` (should return 1)

#### View container CPU usage:
```promql
rate(container_cpu_usage_seconds_total{name!=""}[5m]) * 100
```

#### Check memory usage:
```promql
container_memory_usage_bytes{name!=""}
```

### 3. Set Up Alerts

#### Test alert rules:
```bash
# Reload Prometheus configuration
curl -X POST http://localhost:9091/-/reload

# Check alert rules
curl http://localhost:9091/api/v1/rules
```

#### View active alerts:
- Prometheus: http://YOUR_VPS_IP:9091/alerts
- Alertmanager: http://YOUR_VPS_IP:9093

### 4. Performance Optimization

#### Reduce resource usage:

**Edit `docker-compose.monitoring.yaml`:**
```yaml
# Reduce Prometheus retention
prometheus:
  command:
    - '--storage.tsdb.retention.time=15d'  # Changed from 30d

# Reduce Loki retention
loki:
  # Edit infra/loki/loki-config.yaml
  retention_period: 360h  # Changed from 720h (15 days)
```

#### Limit log ingestion:
```yaml
# Edit infra/loki/loki-config.yaml
limits_config:
  ingestion_rate_mb: 2  # Reduced from 4
  max_streams_per_user: 2500  # Reduced from 5000
```

---

## Troubleshooting

### Issue: Promtail not collecting logs

**Solution:**
```bash
# Check Promtail logs
docker compose logs promtail

# Verify Docker socket permission
ls -la /var/run/docker.sock

# Restart Promtail
docker compose restart promtail
```

### Issue: Prometheus not scraping targets

**Solution:**
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets

# Verify network connectivity
docker network inspect lithosphere_litho-network

# Check Prometheus configuration
docker compose exec prometheus cat /etc/prometheus/prometheus.yml
```

### Issue: Grafana dashboards not showing data

**Solution:**
1. Check datasources: **Configuration → Data Sources**
2. Test connection to Prometheus and Loki
3. Verify time range in dashboard (top-right)
4. Check if services are being scraped: **Explore → Prometheus → `up`**

### Issue: High disk usage

**Solution:**
```bash
# Check Docker volumes
docker system df -v

# Clean up old logs
docker compose exec loki rm -rf /loki/chunks/*

# Prune unused Docker resources
docker system prune -a --volumes
```

---

## Maintenance

### Regular Tasks

#### Weekly:
- Review Grafana dashboards for anomalies
- Check alert history in Alertmanager
- Verify disk space usage

#### Monthly:
- Update monitoring stack images:
  ```bash
  docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml pull
  docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
  ```
- Review and tune alert thresholds
- Backup Grafana dashboards

### Backup Grafana Dashboards

```bash
# Export dashboard JSON
curl -u admin:lithosphere \
  http://localhost:3001/api/dashboards/uid/lithosphere-system-overview \
  | jq '.dashboard' > backup-system-overview.json

# Backup Grafana database
docker compose exec grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker compose cp grafana:/tmp/grafana-backup.tar.gz ./grafana-backup.tar.gz
```

---

## Resource Requirements

| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Prometheus | 0.5 cores | 512 MB | 10 GB |
| Loki | 0.25 cores | 256 MB | 5 GB |
| Grafana | 0.25 cores | 256 MB | 1 GB |
| Promtail | 0.1 cores | 128 MB | - |
| Node Exporter | 0.1 cores | 64 MB | - |
| cAdvisor | 0.25 cores | 128 MB | - |
| Alertmanager | 0.1 cores | 128 MB | 500 MB |
| **Total** | **~1.5 cores** | **~1.5 GB** | **~17 GB** |

### Minimum VPS Requirements
- **CPU**: 4 cores (2 for apps + 2 for monitoring)
- **RAM**: 8 GB (4 GB for apps + 4 GB for monitoring)
- **Disk**: 80 GB SSD

---

## Advanced Configuration

### Enable HTTPS for Grafana

```yaml
# Add to docker-compose.monitoring.yaml
grafana:
  environment:
    - GF_SERVER_PROTOCOL=https
    - GF_SERVER_CERT_FILE=/var/lib/grafana/ssl/cert.pem
    - GF_SERVER_CERT_KEY=/var/lib/grafana/ssl/key.pem
  volumes:
    - ./ssl:/var/lib/grafana/ssl:ro
```

### Add PostgreSQL Exporter

```yaml
# Add to docker-compose.monitoring.yaml
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:v0.15.0
  environment:
    - DATA_SOURCE_NAME=${DATABASE_URL}
  networks:
    - litho-network
```

---

## Support

For issues or questions:
1. Check logs in Grafana (Explore → Loki)
2. Review Prometheus alerts: http://YOUR_VPS_IP:9091/alerts
3. Check GitHub Action runs: https://github.com/KaJLabs/lithosphere/actions
4. Create an issue: https://github.com/KaJLabs/lithosphere/issues

---

## Next Steps

1. ✅ Configure Slack/Email notifications in Alertmanager
2. ✅ Set up VPS firewall rules to restrict monitoring ports
3. ✅ Create custom Grafana dashboards for your needs
4. ✅ Integrate with PagerDuty for on-call alerts
5. ✅ Set up log retention policies based on requirements
