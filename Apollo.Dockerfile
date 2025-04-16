FROM node:23.10.0-alpine3.21

RUN apk add --no-cache curl=8.12.1-r1

RUN npm install -g pnpm@10.6.5 typescript@5.8.2

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY tsconfig.server.json tsconfig.server.json
COPY docker docker
COPY .env .env

RUN pnpm install && tsc --project tsconfig.server.json

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD node ./out/docker/apollo-server/schemaFetcher.js && \
    node ./out/docker/apollo-server/server.mjs
