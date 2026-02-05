# ============================================================================
# Lithosphere API Service - Production Dockerfile
# Multi-stage build for minimal, secure production images
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Dependencies
# ----------------------------------------------------------------------------
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

# ----------------------------------------------------------------------------
# Stage 2: Builder
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN pnpm run build

RUN pnpm prune --prod

# ----------------------------------------------------------------------------
# Stage 3: Production Runner
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner

# Install security updates and wget for healthchecks
RUN apk update && apk upgrade --no-cache && apk add --no-cache wget

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:4000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
