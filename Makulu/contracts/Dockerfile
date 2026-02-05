# ============================================================================
# Lithosphere Contracts Service - Production Dockerfile
# For contract deployment and verification
# ============================================================================

FROM node:20-alpine AS deps

RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN if [ -f pnpm-lock.yaml ]; then \
        pnpm install --frozen-lockfile; \
    else \
        pnpm install; \
    fi

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate

# Compile contracts
RUN pnpm run compile

FROM node:20-alpine AS runner

RUN apk update && apk upgrade --no-cache

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

COPY --from=builder --chown=lithosphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=lithosphere:nodejs /app/artifacts ./artifacts
COPY --from=builder --chown=lithosphere:nodejs /app/typechain-types ./typechain-types
COPY --from=builder --chown=lithosphere:nodejs /app/scripts ./scripts
COPY --from=builder --chown=lithosphere:nodejs /app/src ./src
COPY --from=builder --chown=lithosphere:nodejs /app/package.json ./package.json
COPY --from=builder --chown=lithosphere:nodejs /app/hardhat.config.ts ./hardhat.config.ts
COPY --from=builder --chown=lithosphere:nodejs /app/tsconfig.json ./tsconfig.json

USER lithosphere

ENV NODE_ENV=production

# Default command runs the deploy script
CMD ["npx", "hardhat", "run", "scripts/deploy.ts", "--network", "testnet"]
