# GitHub Actions Secrets Configuration

This document describes the required GitHub Secrets for automated deployment.

## Required Secrets

Navigate to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 1. SSH Connection Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH private key for server access | `-----BEGIN OPENSSH PRIVATE KEY-----`<br>Your private key content<br>`-----END OPENSSH PRIVATE KEY-----` |
| `SERVER_IP` | VPS/Server IP address | `72.60.177.106` |
| `SERVER_USER` | SSH username | `root` |

### 2. Application Configuration Secrets (Optional)

These can be added to the `.env` file on the server manually, or configured as secrets for automatic injection:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/lithosphere` |
| `LITHO_RPC_URL` | Blockchain RPC endpoint | `https://testnet-rpc.lithosphere.network` |
| `LITHO_CHAIN_ID` | Chain ID | `61` |

## Generating SSH Key Pair

If you don't have an SSH key pair, generate one:

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/lithosphere_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/lithosphere_deploy.pub root@72.60.177.106

# Copy private key content for GitHub Secret
cat ~/.ssh/lithosphere_deploy
# Copy the entire output including BEGIN and END lines
```

## Adding Secrets to GitHub

1. Go to your repository: https://github.com/KaJLabs/lithosphere
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - **Name**: `SSH_PRIVATE_KEY`
   - **Value**: Paste your private key (entire content)
   - Click **Add secret**
5. Repeat for `SERVER_IP` and `SERVER_USER`

## Verifying Secrets

After adding secrets, you can trigger a deployment:

1. Go to **Actions** tab
2. Select **Deploy to VPS** workflow
3. Click **Run workflow**
4. Select environment (testnet/staging/mainnet)
5. Click **Run workflow**

The workflow will:
- Connect to your server via SSH
- Pull latest code from GitHub
- Build Docker images
- Deploy services
- Run health checks

## Deployment Workflow

The deployment happens automatically on:
- Push to `main` branch (changes in `Makulu/**`)
- Manual trigger via GitHub Actions UI

### Workflow Steps:
1. ✅ Checkout code
2. ✅ Setup SSH connection
3. ✅ Pull latest code on server  
4. ✅ Build Docker images
5. ✅ Deploy services
6. ✅ Health checks
7. ✅ Rollback on failure

## Security Best Practices

- ✅ Never commit private keys to the repository
- ✅ Use SSH keys instead of passwords
- ✅ Rotate SSH keys periodically
- ✅ Use environment-specific secrets for staging/production
- ✅ Limit SSH key permissions to deployment user only
- ✅ Use read-only database credentials where possible

## Troubleshooting

### SSH Connection Failed
```
Permission denied (publickey)
```
**Solution**: Verify `SSH_PRIVATE_KEY` is correctly formatted with BEGIN/END lines

### Health Check Failed
```
API health check failed after 5 attempts
```
**Solution**: Check server logs: `ssh root@SERVER_IP "cd /opt/lithosphere/Makulu && docker compose logs api"`

### Build Failed
```
docker compose build failed
```
**Solution**: Check for syntax errors in Dockerfile or dependencies issues

## Manual Deployment

If automated deployment fails, deploy manually:

```bash
ssh root@72.60.177.106

cd /opt/lithosphere
git clone https://github.com/KaJLabs/lithosphere.git temp
cp -r temp/Makulu/* Makulu/
rm -rf temp

cd Makulu
docker compose build
docker compose up -d
docker compose ps
```
