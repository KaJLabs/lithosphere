# Promotion & Rollback Playbook

> Standard operating procedures for environment promotion and rollback on Lithosphere Makalu.

## Promotion Flow

```
LOCAL  -->  TESTNET (Makalu)  -->  MAINNET
            auto on push           manual via promote.yaml
            deploy-simple.yaml     GitHub Environment approval
```

Staging is optional — promote directly from testnet to mainnet when staging is not configured.

## Environment Promotion

### Testnet (Automatic)

Testnet deploys automatically on every push to `main`:

1. CI passes (lint, build, test, gitleaks)
2. PR merged to `main`
3. `deploy-simple.yaml` triggers automatically
4. SSH deploy via bastion to EC2
5. Health checks verify API and Explorer

No manual intervention required.

### Mainnet (Manual with Approval)

1. **Identify the image tag** to promote:
   ```bash
   # Find the tag from a successful testnet deploy
   # Check the deploy-simple.yaml run summary for the commit SHA
   # Or use the GHCR tag format: testnet-YYYYMMDD-HHMMSS
   ```

2. **Trigger promotion** via GitHub Actions:
   - Go to Actions > "Promote" workflow
   - Click "Run workflow"
   - Select:
     - Source: `testnet`
     - Target: `mainnet`
     - Image tag: the tag from step 1 (e.g. `sha-abc1234` or `testnet-20260307-143000`)
   - Click "Run workflow"

3. **Approval gate**:
   - A reviewer listed in the `mainnet` GitHub Environment must approve
   - Configure reviewers: Settings > Environments > mainnet > Required reviewers
   - Reviewer verifies the image tag was tested on testnet

4. **Deployment proceeds** automatically after approval:
   - Images retagged with `mainnet` and `mainnet-{timestamp}`
   - SSH deploy to EC2 via bastion
   - Health checks run post-deploy
   - Automatic rollback on failure

### Deployment Windows

| Environment | Days | Hours (UTC) |
|-------------|------|-------------|
| Testnet | Any | Any |
| Mainnet | Tue-Thu | 14:00-16:00 |

**Freeze periods:** Dec 20 - Jan 5, during chain events, 48h minimum between mainnet deploys.

## Rollback Procedures

### Automatic Rollback

Both `deploy-simple.yaml` and `deploy.yaml` include automatic rollback:

- A rollback snapshot is saved before each deploy (compose file, .env, image list)
- If health checks fail after deploy, the rollback job restores the snapshot
- The rollback job triggers automatically — no manual intervention needed

### Manual Rollback (SSH)

If automatic rollback fails or you need to roll back outside of CI:

```bash
# 1. SSH to the server
ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16

# 2. Option A: Use the rollback script
cd /opt/lithosphere/Makulu
sudo bash scripts/rollback.sh

# 2. Option B: Manual restore from snapshot
cd /opt/lithosphere/Makulu
cp .rollback/docker-compose.yaml.bak docker-compose.yaml
cp .rollback/.env.bak .env
sudo docker compose down --timeout 30
sudo docker compose up -d --remove-orphans

# 3. Verify
curl -s http://localhost:4000/health
curl -s http://localhost:3100
```

### Manual Rollback (Git-based)

Roll back to a specific commit:

```bash
ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16

cd /opt/lithosphere/Makulu
# View recent deploys
git log --oneline -10

# Checkout previous known-good commit
git checkout <commit-sha>
sudo docker compose up -d --build --remove-orphans

# Verify
curl -s http://localhost:4000/health
```

### Mainnet Rollback Requirements

For mainnet rollbacks:
1. Notify the on-call engineer before starting
2. Execute the rollback (any method above)
3. Verify all health endpoints respond
4. File a post-incident review within 24h

## Emergency Hotfix Fast-Path

For critical production issues:

1. Create a fix branch from `main`
2. Push and merge the fix PR (expedited review)
3. `deploy-simple.yaml` auto-deploys to testnet
4. Immediately trigger `promote.yaml` with:
   - `skip_approval: true` (emergency flag)
   - Image tag from the testnet deploy

Document the emergency in a post-incident review.

## Blue/Green Deploy (Optional)

For zero-downtime deploys, use the blue/green script:

```bash
ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16
cd /opt/lithosphere/Makulu
sudo bash scripts/blue-green-deploy.sh
```

This:
1. Saves a rollback snapshot
2. Builds the new version as an isolated Docker Compose project
3. Health-checks the new version
4. Cuts over traffic only if healthy
5. Keeps the old version available for instant rollback

## Health Check Endpoints

| Endpoint | Port | Expected |
|----------|------|----------|
| API health | `:4000/health` | HTTP 200 |
| API litho | `:4000/api/litho` | HTTP 200 |
| GraphQL | `:4000/graphql` | HTTP 200 (POST) |
| Explorer | `:3100` | HTTP 200/302 |
| Prometheus | `:9090/metrics` | HTTP 200 |

## GitHub Environment Setup

To enable approval gates for mainnet:

1. Go to repo Settings > Environments
2. Create environment: `mainnet`
3. Add required reviewers (1-2 team leads)
4. Optionally add deployment branch rules (only `main`)
5. The `promote.yaml` workflow uses this environment for the approval gate

Similarly for `staging` if needed.

## Troubleshooting

### Deploy stuck / SSH timeout
```bash
# Check bastion connectivity
ssh ec2-user@44.218.142.100 echo "bastion ok"

# Check indexer via bastion
ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16 echo "indexer ok"
```

### Containers not starting
```bash
ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16
cd /opt/lithosphere/Makulu
sudo docker compose ps -a
sudo docker compose logs --tail 50 api
sudo docker compose logs --tail 50 indexer
```

### Disk full
```bash
sudo docker system prune -a --volumes -f
df -h /var/lib/docker
```
