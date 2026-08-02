FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# entrypoint.mjs fetches secrets from Secrets Manager, then imports the app —
# ordering that a static import inside index.js can't guarantee (see preload.js).
CMD ["node", "src/entrypoint.mjs"]
