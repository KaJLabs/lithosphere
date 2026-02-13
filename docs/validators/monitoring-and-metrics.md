# Monitoring and Metrics

## Overview

Lithosphere provides a comprehensive observability stack for monitoring validator nodes, infrastructure health, and application performance. The stack is built on industry-standard open-source tools and covers metrics collection, log aggregation, alerting, dashboards, and distributed tracing.

---

## Prometheus

Prometheus is the core metrics collection and storage engine. It scrapes metrics from all Lithosphere services at configured intervals.

### Configuration

The Prometheus configuration is defined in `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'lithosphere-api'
    static_configs:
      - targets: ['api:9090']

  - job_name: 'lithosphere-indexer'
    static_configs:
      - targets: ['indexer:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
```

### Scrape Targets

| Target | Port | Description |
|--------|------|-------------|
| API | 9090 | Lithosphere API service metrics |
| Indexer | 9090 | Blockchain indexer metrics |
| Node Exporter | 9100 | Host-level system metrics (CPU, memory, disk, network) |
| cAdvisor | 8080 | Container-level resource usage and performance metrics |

---

## Alert Rules

Alert rules are defined in `lithosphere-alerts.yml` and evaluated by Prometheus. Alerts fire when specified conditions are met over a defined duration.

### Alert Categories

**Service Health**

- Service instance down for more than 1 minute
- API endpoint returning errors above threshold
- Indexer falling behind chain head

**Performance**

- Request latency exceeding acceptable thresholds
- Transaction processing time degradation
- Block sync rate dropping below expected levels

**Resources**

- CPU usage sustained above threshold
- Memory usage exceeding configured limits
- Disk space running low on data volumes

**Container Issues**

- Container restart loops detected
- Container OOM (out-of-memory) kills
- Unhealthy container health checks

---

## Grafana Dashboards

Grafana provides the visualization layer for all collected metrics. Pre-configured dashboards are available out of the box.

### Pre-configured Dashboards

| Dashboard | Description |
|-----------|-------------|
| **System Overview** | Host-level metrics including CPU, memory, disk I/O, and network throughput |
| **API Monitoring** | Request rates, latency percentiles, error rates, and endpoint-level breakdowns |
| **Container Metrics** | Per-container CPU, memory, network, and disk usage from cAdvisor |

### Auto-provisioning

Dashboards and data sources are automatically provisioned from the `grafana/provisioning/` directory. No manual configuration is required on first startup.

### Access

- **URL:** `http://localhost:3000`
- **Default credentials:** `admin` / `lithosphere`

> **Important:** Change the default password immediately after first login in any non-local environment.

### Adding Custom Dashboards

To add a custom dashboard:

1. Create the dashboard in the Grafana UI.
2. Export it as JSON via **Share > Export > Save to file**.
3. Place the JSON file in `grafana/provisioning/dashboards/`.
4. The dashboard will be automatically loaded on next restart.

---

## Loki -- Log Aggregation

Loki provides centralized log aggregation for all Lithosphere services.

### Configuration

| Parameter | Value |
|-----------|-------|
| **Retention** | 30 days |
| **Ingestion rate limit** | 4 MB/s |
| **Storage backend** | Filesystem |

Loki stores logs on the local filesystem by default. For production deployments, consider configuring an object storage backend (S3, GCS) for improved durability and scalability.

---

## Promtail -- Log Collection

Promtail is the log collection agent that ships logs to Loki.

### Sources

- **Docker container logs** -- Automatically collected from all running containers.
- **System logs** -- Host-level system logs (syslog, journald).

### Features

- **Auto-discovery** -- Automatically discovers new containers and begins collecting their logs without manual configuration.
- **JSON parsing pipeline** -- Parses structured JSON log output to extract labels and fields for efficient querying in Loki.

---

## AlertManager -- Routing and Notifications

AlertManager receives alerts from Prometheus and routes them to the appropriate notification channels based on configurable rules.

### Notification Channels

**Slack Integration:**

```yaml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#lithosphere-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

**Email Integration:**

```yaml
receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'ops-team@example.com'
        from: 'alertmanager@lithosphere.network'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alertmanager'
        auth_password: '<password>'
```

### Routing

Configure routing rules to direct alerts to specific channels based on severity, service, or other labels:

```yaml
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'email-notifications'
```

---

## Performance Tuning

### Reduce Disk Usage

- Lower Prometheus retention period (default: 15 days). Set `--storage.tsdb.retention.time=7d` for shorter retention.
- Increase Loki chunk target size to reduce the number of stored chunks.
- Enable Prometheus WAL compression with `--storage.tsdb.wal-compression`.

### Reduce Memory Consumption

- Set container memory limits in your Docker Compose or Kubernetes manifests.
- Reduce Prometheus `--storage.tsdb.max-block-duration` to limit in-memory block sizes.
- Limit Loki ingester memory with `ingester.max-chunk-age` and `ingester.max-chunk-idle`.

### Optimize Scrape Intervals

- Increase the scrape interval for less critical targets (e.g., system metrics can use 30s or 60s intervals).
- Use relabeling rules to drop high-cardinality metrics that are not needed.
- Avoid scraping the same target from multiple Prometheus instances unless high availability is required.

---

## Adding Custom Alerts

To add a custom alert rule:

1. Edit `lithosphere-alerts.yml` (or create a new rules file).
2. Define the alert using PromQL:

```yaml
groups:
  - name: custom-alerts
    rules:
      - alert: HighBlockSyncLatency
        expr: rate(block_sync_duration_seconds_sum[5m]) / rate(block_sync_duration_seconds_count[5m]) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Block sync latency is high"
          description: "Average block sync time has exceeded 2 seconds for the last 5 minutes."
```

3. Reload Prometheus configuration (send SIGHUP or use the `/-/reload` endpoint).

---

## OpenTelemetry Tracing

Lithosphere supports distributed tracing via OpenTelemetry for end-to-end request visibility across services.

### Components

| Component | Purpose |
|-----------|---------|
| **OTel JS SDK** | Instruments application code to generate trace spans |
| **OTel Collector** | Receives, processes, and exports trace data |
| **Grafana Tempo** | Trace storage and query backend |

### How It Works

1. The **OTel JS SDK** is integrated into Lithosphere services to automatically instrument HTTP requests, database calls, and custom operations.
2. Traces are sent to the **OTel Collector**, which processes them (batching, sampling, enrichment) and exports them to the storage backend.
3. **Grafana Tempo** stores traces and makes them queryable through the Grafana UI.
4. In Grafana, traces can be correlated with logs (via Loki) and metrics (via Prometheus) using trace IDs for full-stack observability.
