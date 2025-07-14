FROM node:23.11.1-alpine3.21 AS base


RUN apk add --no-cache \
    python3=3.12.11-r0 \
    make=4.4.1-r2 \
    g++=14.2.0-r4 \
    curl=8.12.1-r1 && \
    npm install -g pnpm@10.6.5 serve@14.2.0 && \
    pnpm add -D js-yaml@4.1.0


WORKDIR /app


RUN addgroup -S appgroup && adduser -S appuser -G appgroup

FROM base AS build

COPY package.json pnpm-lock.yaml checkNodeVersion.js scripts/*.mjs ./

RUN pnpm install

FROM base AS final

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules

RUN node scripts/fetchSwaggerSchema.mjs && \
    node scripts/patchSwaggerServer.mjs

RUN npx next build && \
    npx next-export-optimize-images


USER appuser


HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ps aux | grep -q '[s]leep infinity' || exit 1

CMD ["sleep","infinity"]
