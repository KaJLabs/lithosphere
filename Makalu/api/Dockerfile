# ============================================================================
# Lithosphere API Service - Production Dockerfile
# Two-stage build for minimal, secure production images
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Build
# ----------------------------------------------------------------------------
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy source and build
COPY . .
RUN pnpm run build

# Remove dev dependencies
RUN pnpm prune --prod

# ----------------------------------------------------------------------------
# Stage 2: Production Runner
# ----------------------------------------------------------------------------
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner

# Build-time metadata (injected by CI; defaults are dev-friendly fallbacks)
ARG GIT_SHA=""
ARG BUILD_TIME=""
ARG VERSION=""

# OCI image labels — surfaced by `docker inspect` and GHCR's package UI
LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.created=$BUILD_TIME
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.source="https://github.com/KaJLabs/Lithosphere"
LABEL org.opencontainers.image.title="lithosphere-api"

# Install security updates and wget for healthchecks
RUN apk update && apk upgrade --no-cache && apk add --no-cache wget

# Strip bundled npm/yarn — unused at runtime (CMD invokes node directly).
# Closes HIGH CVEs in npm's transitive deps (cross-spawn, glob, minimatch, tar)
# without waiting for upstream node:20-alpine to ship a patched npm.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /opt/yarn-* \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

# Copy built application
COPY --from=builder --chown=lithosphere:nodejs /app/dist ./dist
COPY --from=builder --chown=lithosphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=lithosphere:nodejs /app/package.json ./package.json

# Switch to non-root user
USER lithosphere

# Expose ports
EXPOSE 4000 9090

# Set environment
ENV NODE_ENV=production
ENV API_PORT=4000

# Propagate build metadata into the runtime environment so /version and the
# litho_api_build_info Prometheus gauge can surface it.
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV VERSION=$VERSION

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:4000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
