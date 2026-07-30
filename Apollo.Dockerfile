FROM public.ecr.aws/docker/library/node:26.5.0-alpine3.23 AS base

RUN apk add --no-cache curl=8.20.0-r0 && \
    npm install -g bun@1.3.5 typescript@5.8.2

WORKDIR /app

COPY package.json bun.lock checkNodeVersion.js ./
COPY tsconfig.server.json tsconfig.server.json
COPY docker docker
COPY contracts contracts
COPY .env .env

RUN bun install --frozen-lockfile
RUN tsc --project tsconfig.server.json

# Seed the committed contract where server.mts expects it. schemaFetcher then
# overwrites it on a successful fetch and, on failure, logs and continues — so
# the mock always starts from a schema matching the pin instead of dying (or
# silently serving nothing) when raw.githubusercontent.com is unreachable.
RUN cp contracts/user-service/schema.graphql out/docker/apollo-server/schema.graphql

CMD node ./out/docker/apollo-server/schemaFetcher.js && \
    node ./out/docker/apollo-server/server.mjs
