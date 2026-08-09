# ============================================================================
# Kamet Explorer Frontend - Multi-stage Docker Build
# ============================================================================

FROM node:20-alpine AS builder

WORKDIR /app/sdk

COPY sdk/package*.json ./
RUN npm ci
COPY sdk/ ./
RUN npm run build

WORKDIR /app/web

# Build-time ARGs — Vite bakes these into the bundle at build time
ARG VITE_RPC_URL=https://rpc-3.litho.ai
ARG VITE_REST_URL=https://api-3.litho.ai
ARG VITE_GRPC_URL
ARG VITE_EVM_RPC_URL=https://rpc-3.litho.ai
ARG VITE_EVM_RPC_DRPC_URL=
ARG VITE_EXPLORER_DATA_API_URL=https://kamet.litho.ai/api
ARG VITE_CHAIN_ID=lithosphere_900523-2
ARG VITE_CHAIN_NAME=Lithosphere Kamet
ARG VITE_DENOM=LITHO
ARG VITE_DECIMALS=18
ARG VITE_APP_NAME=Lithosphere Kamet
ARG VITE_APP_DESCRIPTION=Explore blocks, transactions, validators, and accounts on Lithosphere Kamet
ARG VITE_FAUCET_URL=https://kamet.litho.ai/faucet
ARG VITE_FAUCET_ASSETS_URL=https://api-3.litho.ai/faucet/assets
ARG VITE_FAUCET_CLAIM_URL=https://api-3.litho.ai/faucet/claim
ARG VITE_MULTX_BRIDGE_ADDRESS=
ARG VITE_MULTX_API_URL=
ARG VITE_LITHO_TOKEN_ADDRESS=
ARG VITE_LITHO_COINGECKO_ID=lithosphere
ARG VITE_LITHO_PRICE_OVERRIDE=
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ALLOWED_HOSTS=
ARG VITE_SENTRY_RELEASE=
ARG VITE_SENTRY_TRACES_SAMPLE_RATE=0
ARG VITE_SENTRY_DEBUG=false
ARG VITE_APP_VERSION=
ARG VITE_PRIVY_APP_ID=
ARG VITE_ENABLE_WEB3MODAL=false

# Export ARGs as ENV so Vite's import.meta.env picks them up during build
ENV VITE_RPC_URL=$VITE_RPC_URL
ENV VITE_REST_URL=$VITE_REST_URL
ENV VITE_GRPC_URL=$VITE_GRPC_URL
ENV VITE_EVM_RPC_URL=$VITE_EVM_RPC_URL
ENV VITE_EVM_RPC_DRPC_URL=$VITE_EVM_RPC_DRPC_URL
ENV VITE_EXPLORER_DATA_API_URL=$VITE_EXPLORER_DATA_API_URL
ENV VITE_CHAIN_ID=$VITE_CHAIN_ID
ENV VITE_CHAIN_NAME=$VITE_CHAIN_NAME
ENV VITE_DENOM=$VITE_DENOM
ENV VITE_DECIMALS=$VITE_DECIMALS
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION
ENV VITE_FAUCET_URL=$VITE_FAUCET_URL
ENV VITE_FAUCET_ASSETS_URL=$VITE_FAUCET_ASSETS_URL
ENV VITE_FAUCET_CLAIM_URL=$VITE_FAUCET_CLAIM_URL
ENV VITE_MULTX_BRIDGE_ADDRESS=$VITE_MULTX_BRIDGE_ADDRESS
ENV VITE_MULTX_API_URL=$VITE_MULTX_API_URL
ENV VITE_LITHO_TOKEN_ADDRESS=$VITE_LITHO_TOKEN_ADDRESS
ENV VITE_LITHO_COINGECKO_ID=$VITE_LITHO_COINGECKO_ID
ENV VITE_LITHO_PRICE_OVERRIDE=$VITE_LITHO_PRICE_OVERRIDE
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ALLOWED_HOSTS=$VITE_SENTRY_ALLOWED_HOSTS
ENV VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE
ENV VITE_SENTRY_TRACES_SAMPLE_RATE=$VITE_SENTRY_TRACES_SAMPLE_RATE
ENV VITE_SENTRY_DEBUG=$VITE_SENTRY_DEBUG
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID
ENV VITE_ENABLE_WEB3MODAL=$VITE_ENABLE_WEB3MODAL

COPY web/package*.json ./
RUN npm ci --legacy-peer-deps
COPY web/ ./
# Increase Node memory limit to handle large vendor chunk (4MB+)
RUN test -n "$VITE_GRPC_URL"
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM nginx:alpine

LABEL maintainer="Lithosphere Team"
LABEL description="Kamet Explorer Frontend"
LABEL version="1.0.0"

RUN apk add --no-cache curl

COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/nginx-snippets/ /etc/nginx/snippets/

RUN mkdir -p /var/log/nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
