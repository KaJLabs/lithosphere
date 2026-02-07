# 🎯 Quick Fix Summary - Lithosphere Audit

## ✅ Fixes Already Applied

The following critical issues have been **automatically fixed** in your codebase:

### 1. ✅ SSH Secret Name Consistency (CRITICAL)
**File:** `.github/workflows/deploy.yaml` Line 437  
**Fixed:** Rollback job now uses correct secret name `VPS_SSH_PRIVATE_KEY`

### 2. ✅ Docker Network Configuration (MEDIUM)
**File:** `docker-compose.monitoring.yaml` Line 215  
**Fixed:** Network now uses `external: true` to connect to main stack

### 3. ✅ Grafana ROOT_URL (LOW)
**File:** `docker-compose.monitoring.yaml` Line 108  
**Fixed:** ROOT_URL now points to correct VPS IP `http://72.60.177.106:3000`

---

## ⚠️ Manual Fixes Required

These fixes require **code changes or GitHub configuration**:

### 🔴 HIGH PRIORITY

#### 1. Add SLSA Provenance Generation
**File:** `.github/workflows/release.yaml`  
**Action:** Add provenance job after `build-and-push`

<details>
<summary>Click to see code to add</summary>

```yaml
# Add this entire job to .github/workflows/release.yaml

  provenance:
    name: Generate SLSA Provenance
    needs: build-and-push
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
    with:
      image: ghcr.io/kajlabs/lithosphere/service-template
      digest: ${{ needs.build-and-push.outputs.digest }}
      registry-username: ${{ github.actor }}
    secrets:
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```
</details>

#### 2. Add Environment-Specific Image Tagging
**File:** `.github/workflows/deploy.yaml`  
**Action:** Insert before deployment step

<details>
<summary>Click to see code to add</summary>

```yaml
# Add this step before the "Deploy to VPS" step

- name: Tag Image for Environment
  env:
    ENVIRONMENT: ${{ github.event.inputs.environment || 'testnet' }}
  run: |
    docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
    docker tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
      ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${ENVIRONMENT}
    docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${ENVIRONMENT}

# Then update the deployment command to use environment tag:
# export IMAGE_TAG=${{ github.event.inputs.environment || 'testnet' }}
```
</details>

#### 3. Add Docker Image Pruning
**File:** `.github/workflows/deploy.yaml`  
**Action:** Add after `docker compose up -d`

<details>
<summary>Click to see code to add</summary>

```yaml
# Add this step after docker compose up

- name: Cleanup Old Images
  run: |
    ssh $SERVER_USER@$SERVER_IP "
      # Remove dangling images
      docker image prune -f
      
      # Remove images older than 7 days
      docker image prune -a --filter 'until=168h' -f
      
      # Show disk usage
      echo '📊 Disk Usage After Cleanup:'
      df -h /var/lib/docker
    "
```
</details>

---

## 🔧 VPS Configuration Steps

Run these commands on your VPS (`72.60.177.106`):

### 1. Change Grafana Default Password
```bash
docker compose exec grafana grafana-cli admin reset-admin-password YOUR_SECURE_PASSWORD
```

### 2. Set Proper .env File Permissions
```bash
cd /opt/lithosphere/Makulu
chmod 600 .env
```

### 3. Configure Firewall Rules
```bash
# Allow API
sudo ufw allow 4000/tcp

# Allow Grafana (restrict to your IP recommended)
sudo ufw allow from YOUR_IP to any port 3000

# Allow Prometheus (restrict to your IP recommended)
sudo ufw allow from YOUR_IP to any port 9091

# Enable firewall
sudo ufw enable
```

### 4. Run Connectivity Test
```bash
cd /opt/lithosphere/Makulu
chmod +x scripts/connectivity-test.sh
./scripts/connectivity-test.sh
```

### 5. Run Master Validation
```bash
chmod +x scripts/master-validation.sh
./scripts/master-validation.sh
```

---

## 🔐 GitHub Secrets Configuration

Ensure these secrets are configured in your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `VPS_SSH_PRIVATE_KEY` | Your SSH private key | Use PEM format |
| `SERVER_IP` | `72.60.177.106` | VPS IP address |
| `SERVER_USER` | `root` | SSH user |
| `VPS_HOST` | `72.60.177.106` | Same as SERVER_IP |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `LITHO_RPC_URL` | Your RPC endpoint | Blockchain RPC |

---

## 📋 Pre-Deployment Checklist

Before deploying to production:

- [ ] Applied all manual code fixes above
- [ ] Configured all GitHub secrets
- [ ] Changed Grafana default password
- [ ] Set firewall rules on VPS
- [ ] Ran connectivity test (all tests pass)
- [ ] Ran master validation (no critical failures)
- [ ] Committed and pushed all changes to GitHub
- [ ] Tested deployment in testnet environment for 24-48 hours

---

## 🚀 Deployment Commands

After all fixes are applied:

```bash
# 1. Commit changes
git add .
git commit -m "fix: apply production readiness audit fixes"
git push origin main

# 2. SSH to VPS
ssh root@72.60.177.106

# 3. Pull latest changes
cd /opt/lithosphere
git pull origin main

# 4. Restart services with monitoring
cd Makulu
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml down
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d --build

# 5. Verify deployment
./scripts/master-validation.sh
```

---

## 📊 Expected Test Results

After applying all fixes, you should see:

- **Connectivity Test:** ✅ All critical tests pass
- **Master Validation:** ✅ 95%+ success rate
- **Zero critical failures**
- **System status: READY**

---

## 🆘 If Tests Fail

1. Check the detailed audit report: `PRODUCTION_READINESS_AUDIT_REPORT.md`
2. Review logs: `docker compose logs -f`
3. Verify all secrets are configured correctly
4. Ensure VPS has minimum 8GB RAM and 80GB disk
5. Check firewall isn't blocking required ports

---

## 📞 Next Steps

1. ✅ Review this summary
2. ⚙️ Apply manual fixes to code
3. 🔐 Configure GitHub secrets
4. 🔧 Run VPS configuration steps
5. ✅ Run validation scripts
6. 🚀 Deploy to testnet
7. 🔍 Monitor for 48 hours
8. 🎯 Deploy to production

---

**Audit Date:** February 7, 2026  
**Status:** 3/6 fixes applied automatically, 3 manual fixes required  
**Estimated Time to Complete:** 1-2 hours
