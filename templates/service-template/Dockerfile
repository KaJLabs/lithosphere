# ─────────────────────────────────────────────────────────────
# Lithosphere Service Template - Multi-stage Docker Build
# Optimized for production with minimal image size
# ─────────────────────────────────────────────────────────────

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ─────────────────────────────────────────────────────────────
# Production stage - minimal image
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 lithosphere

WORKDIR /app

# Copy production dependencies and built code
COPY --from=builder --chown=lithosphere:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=lithosphere:nodejs /app/dist ./dist
COPY --from=builder --chown=lithosphere:nodejs /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER lithosphere

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "dist/index.js"]
