FROM node:23.11.1-alpine3.21


RUN apk add --no-cache curl=8.12.1-r1 && \
    npm install -g pnpm@10.6.5 typescript@5.8.2


RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app


COPY package.json pnpm-lock.yaml tsconfig.server.json checkNodeVersion.js docker .env ./


RUN pnpm install && \
    tsc --project tsconfig.server.json


HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1


CMD ["sh", "-c", "node ./out/docker/apollo-server/schemaFetcher.js && node ./out/docker/apollo-server/server.mjs"]
