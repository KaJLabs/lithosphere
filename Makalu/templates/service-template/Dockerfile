# ============================================================================
# Lithosphere Service - Production Dockerfile
# Multi-stage build for minimal, secure production images
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all dependencies including devDependencies for building
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install security updates
RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy package files (pnpm-lock.yaml may not exist for templates)
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install all dependencies (including dev for building)
# Use --no-frozen-lockfile for templates that may not have a lockfile
RUN if [ -f pnpm-lock.yaml ]; then \
        pnpm install --frozen-lockfile; \
    else \
        pnpm install; \
    fi

# ----------------------------------------------------------------------------
# Stage 2: Builder
# Build the TypeScript application
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm for build
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build the application
RUN pnpm run build

# Prune dev dependencies for production
RUN pnpm prune --prod

# ----------------------------------------------------------------------------
# Stage 3: Production
# Minimal production image
# ----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Security: Install security updates and dumb-init for proper signal handling
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder --chown=lithosphere:nodejs /app/dist ./dist
COPY --from=builder --chown=lithosphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=lithosphere:nodejs /app/package.json ./

# Security: Set proper permissions
RUN chmod -R 550 /app && \
    chmod -R 770 /app/dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose ports
EXPOSE 3000

# Security: Run as non-root user
USER lithosphere

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# ----------------------------------------------------------------------------
# Labels (OCI Image Spec)
# ----------------------------------------------------------------------------
LABEL org.opencontainers.image.title="Lithosphere Service"
LABEL org.opencontainers.image.description="Production-grade Node.js service"
LABEL org.opencontainers.image.vendor="Lithosphere"
LABEL org.opencontainers.image.source="https://github.com/lithosphere/infrastructure"
LABEL org.opencontainers.image.licenses="MIT"
