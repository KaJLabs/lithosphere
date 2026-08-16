# Lithosphere Explorer Frontend - Deployment Guide

Build and deploy the BlockAI Dashboard to makalu.litho.ai

---

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Update API endpoints in .env.local for your setup
VITE_RPC_URL=http://localhost:26657
VITE_REST_URL=http://localhost:1317

# Start development server
npm run dev

# Open http://localhost:5173
```

### Local Docker Build & Test

```bash
# Build Docker image
docker build -t lithosphere-explorer:latest .

# Run container locally
docker run -p 3001:80 lithosphere-explorer:latest

# Test
curl http://localhost:3001/health

# Open http://localhost:3001
```

### Production Deployment

#### Via Ansible (Recommended)

```bash
cd /path/to/litho-validator-infra/ansible

# Deploy to Sentry-01
ansible-playbook playbooks/deploy-explorer-frontend.yml \
  -e "target_hosts=sentry-01" \
  -e "nginx_domain=makalu.litho.ai"
```

#### Via Docker Compose (Manual)

```bash
# Build image
docker build -t lithosphere-explorer:latest .

# Run with Docker Compose
docker-compose -f docker-compose.yml up -d

# Verify
docker ps
docker logs lithosphere-explorer
curl http://localhost:3001/health
```

---

## Configuration

### Environment Variables

Create `.env.local` or pass to Docker:

```bash
# RPC Endpoints
VITE_RPC_URL=https://rpc.litho.ai
VITE_REST_URL=https://api.litho.ai
# grpc.litho.ai is pending DNS and cert issuance; use the current direct endpoint
VITE_GRPC_URL=<KAMET_GRPC_ENDPOINT>
VITE_EVM_RPC_URL=https://rpc.litho.ai

# Chain Configuration
VITE_CHAIN_ID=lithosphere_700777-2
VITE_CHAIN_NAME=Lithosphere Makalu
VITE_DENOM=LITHO
VITE_DECIMALS=18

# Application
VITE_APP_NAME=Lithosphere Explorer
VITE_APP_DESCRIPTION=Explore blocks, transactions, validators, and accounts on Lithosphere
```

### API Configuration

Edit `src/config/api.js`:

```javascript
export const CHAIN_CONFIG = {
  chainId: 'lithosphere_700777-2',
  evmChainId: 700777,
  chainName: 'Lithosphere Makalu',
  rpcUrl: 'https://rpc.litho.ai',
  restUrl: 'https://api.litho.ai',
  grpcUrl: process.env.KAMET_GRPC_ENDPOINT,
};
```

### Branding

1. **Brand vectors**: Update `src/assets/icons/logo.svg` and `src/assets/icons/litho-mark.svg`
2. **Generated raster assets**: Run `npm run generate:brand-assets` to refresh `public/logo.jpg` and `public/favicon.ico`
3. **Favicon SVG**: Keep `public/favicon.svg` aligned with the current brand mark
4. **Colors**: Edit `src/scss/` for theme customization

---

## Build

### Production Build

```bash
# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Output files in ./dist/
```

### Docker Image

```bash
# Build image
docker build -t lithosphere-explorer:1.0.0 .

# Tag for registry
docker tag lithosphere-explorer:1.0.0 your-registry/lithosphere-explorer:1.0.0

# Push to registry
docker push your-registry/lithosphere-explorer:1.0.0
```

---

## Deployment Architecture

```
User Browser
    ↓ (HTTPS)
Nginx Reverse Proxy (makalu.litho.ai:443)
    ↓ (HTTP)
Docker Container (lithosphere-explorer:80)
    ↓ (calls)
Lithosphere RPC (api.litho.ai)
```

---

## Nginx Configuration

### HTTP to HTTPS Redirect

```nginx
server {
    listen 80;
    server_name makalu.litho.ai;
    return 301 https://$server_name$request_uri;
}
```

### HTTPS with TLS

```nginx
server {
    listen 443 ssl http2;
    server_name makalu.litho.ai;

    ssl_certificate /etc/letsencrypt/live/makalu.litho.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/makalu.litho.ai/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

### TLS Certificate Setup

```bash
# Generate certificate with Certbot
sudo certbot certonly --standalone \
  -d makalu.litho.ai \
  --agree-tos \
  --email admin@litho.ai

# Auto-renewal (runs in cron)
sudo certbot renew
```

---

## Monitoring & Logs

### Docker Logs

```bash
# View container logs
docker logs lithosphere-explorer

# Follow logs in real-time
docker logs -f lithosphere-explorer

# View last 100 lines
docker logs --tail 100 lithosphere-explorer
```

### Nginx Logs

```bash
# Access logs
tail -f /var/log/nginx/explorer_access.log

# Error logs
tail -f /var/log/nginx/explorer_error.log
```

### Health Check

```bash
# Test explorer endpoint
curl -I http://localhost:3001/health

# Expected: HTTP 200 OK
```

---

## Troubleshooting

### Build Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

### Docker Build Failures

```bash
# Build with verbose output
docker build -t lithosphere-explorer:latest . --progress=plain

# Check Dockerfile syntax
docker build --no-cache -t lithosphere-explorer:latest .
```

### Connection Issues

1. **Can't reach RPC**:
   - Verify RPC endpoint in .env
   - Check network connectivity
   - Verify CORS headers on RPC server

2. **Nginx not proxying**:
   - Check Nginx logs: `tail -f /var/log/nginx/error.log`
   - Verify container is running: `docker ps`
   - Test container health: `curl http://localhost:3001/health`

3. **TLS Certificate Issues**:
   - Check certificate validity: `openssl s_client -connect makalu.litho.ai:443`
   - Renew certificate: `sudo certbot renew --force-renewal`

---

## Performance Optimization

### Gzip Compression

Nginx config includes gzip compression:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1024;
```

### Caching

Static assets are cached:

```nginx
# JavaScript/CSS - 1 year
location ~* \.(js|css)$ {
    expires 1y;
}

# Images - 1 month
location ~* \.(png|jpg|svg)$ {
    expires 30d;
}

# HTML - No cache
location ~* \.html$ {
    expires -1;
}
```

### Resource Limits

Set limits in Docker Compose:

```yaml
services:
  explorer:
    resources:
      limits:
        cpus: '2'
        memory: 1G
      reservations:
        cpus: '1'
        memory: 512M
```

---

## Security

### Headers

Nginx sets security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000";
```

### CORS

If RPC server doesn't support CORS, add to Nginx config:

```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
add_header Access-Control-Allow-Headers "Content-Type";
```

---

## Rollback

### Rollback to Previous Version

```bash
# Stop current container
docker stop lithosphere-explorer

# Remove container
docker rm lithosphere-explorer

# Run previous image version
docker run -d \
  --name lithosphere-explorer \
  -p 3001:80 \
  lithosphere-explorer:previous-version
```

### Database/State Backup

```bash
# Backup explorer data (if applicable)
docker exec lithosphere-explorer tar -czf explorer-backup.tar.gz /app/data
docker cp lithosphere-explorer:/explorer-backup.tar.gz ./
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

```bash
# Run multiple instances on different ports
docker run -d --name explorer-1 -p 3001:80 lithosphere-explorer:latest
docker run -d --name explorer-2 -p 3002:80 lithosphere-explorer:latest
docker run -d --name explorer-3 -p 3003:80 lithosphere-explorer:latest

# Load balance with Nginx upstream
upstream explorer {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
```

### Vertical Scaling (More Resources)

```yaml
# In docker-compose.yml
services:
  explorer:
    resources:
      limits:
        cpus: '4'
        memory: 4G
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Explorer

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: lithosphere-explorer:latest
```

---

## Support

For issues or questions:
1. Check logs: `docker logs lithosphere-explorer`
2. Review configuration: `cat .env.local`
3. Test connectivity: `curl https://rpc.litho.ai/status`
4. Check Nginx: `sudo nginx -t`

---

## References

- **BlockAI Dashboard**: https://github.com/blockAI-Ltd/explorer
- **Lithosphere Documentation**: https://docs.litho.ai
- **Docker Documentation**: https://docs.docker.com
- **Nginx Documentation**: https://nginx.org/en/docs/
