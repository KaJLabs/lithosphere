FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /var/lib/multx-signer && chown -R node:node /app /var/lib/multx-signer
USER node

EXPOSE 9443
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const s=require('net').connect(9443,'127.0.0.1');s.setTimeout(2000);s.on('connect',()=>{s.end();process.exit(0)});s.on('timeout',()=>process.exit(1));s.on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]
