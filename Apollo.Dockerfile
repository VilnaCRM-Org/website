FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base

RUN apk add --no-cache curl=8.20.0-r0

RUN npm install -g pnpm@10.6.5 typescript@5.8.2

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY tsconfig.server.json tsconfig.server.json
COPY docker docker
COPY .env .env

RUN pnpm install
RUN tsc --project tsconfig.server.json

CMD node ./out/docker/apollo-server/schemaFetcher.js && \
    node ./out/docker/apollo-server/server.mjs
