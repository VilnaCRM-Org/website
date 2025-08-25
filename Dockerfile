FROM public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS base

RUN apk add --no-cache \
    curl=8.12.1-r1 \
    g++=14.2.0-r4 \
    make=4.4.1-r2 \
    python3=3.12.11-r0 && \
    npm install -g pnpm@10.6.5 serve@14.2.0 && \
    pnpm add -D js-yaml@4.1.0

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js scripts/*.mjs ./

RUN pnpm install

FROM base AS build

COPY . .

RUN node scripts/fetchSwaggerSchema.mjs && \
    node scripts/patchSwaggerServer.mjs && \
    npx next build && \
    npx next-export-optimize-images

FROM public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app

COPY --from=build /app/out ./out

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["serve", "out", "-p", "3001"]
