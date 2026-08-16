# ============================================================================
# Lithosphere Block Explorer - Production Dockerfile
# Two-stage build for Next.js application
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

# Copy source
COPY . .

# Accept build-time env vars for Next.js public config
ARG NEXT_PUBLIC_RPC_URL=http://localhost:8545
ARG NEXT_PUBLIC_CHAIN_ID=700777
ARG NEXT_PUBLIC_COSMOS_CHAIN_ID=lithosphere_700777-2
ARG NEXT_PUBLIC_CHAIN_NAME=Litho Devnet
ARG NEXT_PUBLIC_NETWORK=testnet
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_EXPLORER_TITLE=Lithoscan
ARG NEXT_PUBLIC_DEFAULT_THEME=dark
ARG NEXT_PUBLIC_BRIDGE_ENABLED=false
ARG NEXT_PUBLIC_SWAP_ROUTER=""

# Build metadata baked into the client bundle so the UI can show what's deployed
ARG GIT_SHA=""
ARG BUILD_TIME=""
ARG VERSION=""

ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV NEXT_PUBLIC_VERSION=$VERSION

ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
ENV NEXT_PUBLIC_COSMOS_CHAIN_ID=$NEXT_PUBLIC_COSMOS_CHAIN_ID
ENV NEXT_PUBLIC_CHAIN_NAME=$NEXT_PUBLIC_CHAIN_NAME
ENV NEXT_PUBLIC_NETWORK=$NEXT_PUBLIC_NETWORK
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_EXPLORER_TITLE=$NEXT_PUBLIC_EXPLORER_TITLE
ENV NEXT_PUBLIC_DEFAULT_THEME=$NEXT_PUBLIC_DEFAULT_THEME
ENV NEXT_PUBLIC_BRIDGE_ENABLED=$NEXT_PUBLIC_BRIDGE_ENABLED
ENV NEXT_PUBLIC_SWAP_ROUTER=$NEXT_PUBLIC_SWAP_ROUTER

RUN pnpm run build

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
LABEL org.opencontainers.image.title="lithosphere-explorer"

RUN apk update && apk upgrade --no-cache && apk add --no-cache wget

# Strip bundled npm/yarn — unused at runtime (CMD invokes `node server.js`).
# Closes HIGH CVEs in npm's transitive deps (cross-spawn, glob, minimatch, tar).
# Next.js standalone output is self-contained and does not call npm.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /opt/yarn-* \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

# Copy Next.js standalone output
COPY --from=builder --chown=lithosphere:nodejs /app/public ./public
COPY --from=builder --chown=lithosphere:nodejs /app/.next/standalone ./
COPY --from=builder --chown=lithosphere:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=lithosphere:nodejs /app/patch-live-makalu-tokens-list-nft.mjs ./patch-live-makalu-tokens-list-nft.mjs

USER lithosphere

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME
ENV VERSION=$VERSION

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
