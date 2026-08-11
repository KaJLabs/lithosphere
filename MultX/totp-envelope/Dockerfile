FROM node:20-bookworm-slim
ARG AWS_SIGNING_HELPER_VERSION=1.8.4
ARG AWS_SIGNING_HELPER_SHA256=b7568acd6e1517a4e1adaee68d52bfd6284a0e5305677166cd83d43a07c815c9
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl --fail --silent --show-error --location \
    "https://rolesanywhere.amazonaws.com/releases/${AWS_SIGNING_HELPER_VERSION}/X86_64/Linux/Amzn2023/aws_signing_helper" \
    --output /usr/local/bin/aws_signing_helper \
  && echo "${AWS_SIGNING_HELPER_SHA256}  /usr/local/bin/aws_signing_helper" | sha256sum --check --strict \
  && chmod 0755 /usr/local/bin/aws_signing_helper \
  && apt-get purge -y --auto-remove curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN chown -R node:node /app
USER node
EXPOSE 9444
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const s=require('net').connect(9444,'127.0.0.1');s.setTimeout(2000);s.on('connect',()=>{s.end();process.exit(0)});s.on('timeout',()=>process.exit(1));s.on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]
