FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk update && apk upgrade --no-cache && apk add --no-cache wget
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod
COPY --from=builder /app/dist dist/
COPY frontend/ frontend/

# The running faucet needs Node.js and its application dependencies only.
# Removing npm/Corepack/pnpm eliminates build-time package-manager code from
# the runtime attack surface (including npm's bundled node-tar).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && rm -rf /root/.cache /root/.local/share/pnpm /tmp/*

EXPOSE 8081
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:8081/health || exit 1
CMD ["node", "dist/index.js"]
