# Troubleshooting

This guide covers common issues encountered when developing, deploying, and operating the Lithosphere platform. Solutions are drawn from the infrastructure configuration (infra/README.md) and deployment secrets documentation (SECRETS.md).

---

## Configuration Not Loading

If services are not picking up configuration changes, follow these diagnostic steps:

### Check Docker Compose Configuration

```bash
# Validate the compose file syntax and merged configuration
docker compose config

# View container logs for a specific service
docker compose logs SERVICE_NAME

# View logs with timestamps and follow mode
docker compose logs -f --timestamps SERVICE_NAME
```

### Validate Prometheus Configuration

```bash
# Check Prometheus config syntax inside the container
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

### Apply Configuration Updates

```bash
# Prometheus supports hot-reload
curl -X POST http://localhost:9091/-/reload

# For other services, restart the specific container
docker compose restart SERVICE_NAME

# Or restart the entire monitoring stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml restart
```

---

## Dashboards Not Appearing in Grafana

If custom dashboards are not visible in Grafana after adding them:

1. **Check the provisioning path is correct.** Dashboard JSON files must be placed in the `infra/grafana/dashboards/` directory.
2. **Validate JSON syntax:**
   ```bash
   jq . infra/grafana/dashboards/your-dashboard.json
   ```
3. **Check Grafana logs for provisioning errors:**
   ```bash
   docker compose logs grafana
   ```
4. **Restart Grafana to reload provisioned dashboards:**
   ```bash
   docker compose restart grafana
   ```

Pre-configured dashboards included with the Lithosphere infrastructure:
- **System Overview** -- VPS health (CPU, RAM, Disk, Network)
- **API Monitoring** -- Request rates, latencies, errors, logs
- **Container Metrics** -- Docker container resource usage

---

## Alerts Not Firing

If expected alerts are not being triggered in the monitoring stack:

1. **Check alert rule syntax** in the Prometheus UI at `http://localhost:9091/alerts`.
2. **Verify Alertmanager is configured** in `prometheus.yml`:
   ```bash
   # Check that the alertmanager target is set
   curl http://localhost:9091/api/v1/rules
   ```
3. **Check Alertmanager status and active alerts:**
   ```bash
   curl http://localhost:9093/api/v2/alerts
   ```
4. **Verify alert rule file** at `infra/prometheus/alerts/lithosphere-alerts.yml` -- rules cover service health (API down, Indexer down, DB down), performance issues (high latency, error rates), resource usage (CPU, memory, disk), and container issues (restarts, high resource usage).

---

## SSH Connection Failed

```
Permission denied (publickey)
```

**Cause:** The `SSH_PRIVATE_KEY` GitHub secret is incorrectly formatted or the corresponding public key is not installed on the target server.

**Solution:**

1. Verify the `SSH_PRIVATE_KEY` secret includes the complete key with `BEGIN` and `END` lines:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   (key content)
   -----END OPENSSH PRIVATE KEY-----
   ```
2. Verify the public key is authorized on the server:
   ```bash
   ssh-copy-id -i ~/.ssh/lithosphere_deploy.pub root@SERVER_IP
   ```
3. Test the connection manually:
   ```bash
   ssh -i ~/.ssh/lithosphere_deploy root@SERVER_IP
   ```
4. If generating a new key pair:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/lithosphere_deploy
   ```

---

## Health Check Failed

```
API health check failed after 5 attempts
```

**Cause:** The API service did not start correctly or is not responding on the expected port.

**Solution:**

1. Check the API server logs:
   ```bash
   ssh root@SERVER_IP "cd /opt/lithosphere/Makulu && docker compose logs api"
   ```
2. Verify the API container is running:
   ```bash
   docker compose ps
   ```
3. Check that required environment variables are set:
   - `DATABASE_URL` -- PostgreSQL connection string
   - `LITHO_RPC_URL` -- Blockchain RPC endpoint
   - `LITHO_CHAIN_ID` -- Chain ID (should be `61`)
4. Test the health endpoint locally:
   ```bash
   curl http://localhost:4000/health
   ```

---

## Build Failed

```
docker compose build failed
```

**Cause:** Syntax errors in a Dockerfile, missing dependencies, or incompatible base image versions.

**Solution:**

1. Check the build output for specific error messages.
2. Verify Dockerfile syntax for each service.
3. Ensure all referenced files and directories exist in the build context.
4. Check that base images are accessible (network issues with Docker Hub).
5. Try building a specific service in isolation:
   ```bash
   docker compose build api
   ```

---

## Manual Deployment Steps

If the automated GitHub Actions deployment fails, deploy manually:

```bash
# SSH into the server
ssh root@SERVER_IP

# Navigate to the deployment directory
cd /opt/lithosphere

# Clone a fresh copy
git clone https://github.com/KaJLabs/lithosphere.git temp
cp -r temp/Makulu/* Makulu/
rm -rf temp

# Navigate to the application directory
cd Makulu

# Build and start services
docker compose build
docker compose up -d

# Verify services are running
docker compose ps
```

---

## Performance Tuning

### Reduce Disk Usage

Reduce retention periods for metrics and logs:

```yaml
# Prometheus -- Reduce retention to 7 days
prometheus:
  command:
    - '--storage.tsdb.retention.time=7d'

# Loki -- Reduce retention to 7 days
# Edit infra/loki/loki-config.yaml
limits_config:
  retention_period: 168h  # 7 days instead of default 30 days (720h)
```

### Reduce Memory Usage

Set memory limits on monitoring containers:

```yaml
# In docker-compose.monitoring.yaml
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

Increase scrape intervals for less-critical metrics:

```yaml
# Prometheus -- Global scrape interval
global:
  scrape_interval: 30s  # Increase from 15s default

# Per-job scrape interval for less critical services
scrape_configs:
  - job_name: 'litho-indexer'
    scrape_interval: 60s
```

---

## Common Environment Variables

Ensure these are set correctly in the `.env` file or exported before running Docker Compose:

```bash
# Grafana
GRAFANA_PORT=3000
GRAFANA_USER=admin
GRAFANA_PASSWORD=lithosphere   # Change in production

# Prometheus
PROMETHEUS_PORT=9091

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# API
API_PORT=4000
LITHO_RPC_URL=https://testnet-rpc.lithosphere.network
LITHO_CHAIN_ID=61
```

---

## Getting Help

If you are unable to resolve an issue using this guide:

1. Check the [CI/CD Guide](ci-cd-guide.md) for pipeline-specific issues.
2. Review the infrastructure README at `Makulu/infra/README.md` for detailed monitoring configuration.
3. Review the secrets documentation at `.github/SECRETS.md` for deployment credential setup.
4. Open an issue on the [GitHub repository](https://github.com/KaJLabs/lithosphere) with:
   - The error message or unexpected behavior
   - Steps to reproduce
   - Environment details (Local, Devnet, Staging, or Mainnet)
   - Relevant log output
