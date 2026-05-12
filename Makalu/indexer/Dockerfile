# ============================================================================
# Lithosphere Indexer Service - Production Dockerfile
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

# Generate code from schema if using subql/subgraph
RUN pnpm run codegen 2>/dev/null || true

RUN pnpm run build

# Remove dev dependencies
RUN pnpm prune --prod

# ----------------------------------------------------------------------------
# Stage 2: Production Runner
# ----------------------------------------------------------------------------
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner

ARG GIT_SHA=""
ARG BUILD_TIME=""
ARG VERSION=""

LABEL org.opencontainers.image.revision=$GIT_SHA
LABEL org.opencontainers.image.created=$BUILD_TIME
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.source="https://github.com/KaJLabs/Lithosphere"
LABEL org.opencontainers.image.title="lithosphere-indexer"

RUN apk update && apk upgrade --no-cache && apk add --no-cache wget

# Strip bundled npm/yarn — unused at runtime (CMD invokes node directly).
# Closes HIGH CVEs in npm's transitive deps (cross-spawn, glob, minimatch, tar).
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /opt/yarn-* \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

COPY --from=builder --chown=lithosphere:nodejs /app/dist ./dist
COPY --from=builder --chown=lithosphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=lithosphere:nodejs /app/package.json ./package.json
COPY --from=builder --chown=lithosphere:nodejs /app/schema.graphql ./schema.graphql

USER lithosphere

EXPOSE 3001

ENV NODE_ENV=production
ENV INDEXER_PORT=3001

ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV VERSION=$VERSION

HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/mappings.js"]
