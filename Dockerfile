FROM public.ecr.aws/docker/library/node:26.5.0-alpine3.23 AS base

RUN apk add --no-cache \
    python3=3.12.13-r0\
    make=4.4.1-r3 \
    g++=15.2.0-r2 \
    curl=8.20.0-r0 && \
    npm install -g bun@1.3.5 serve@14.2.0


WORKDIR /app

COPY package.json bun.lock checkNodeVersion.js scripts/*.mjs ./

RUN bun install --frozen-lockfile


FROM base AS build

COPY . .

# Reads the committed contract under contracts/ — no network. Refresh it with
# `make update-contracts`; `make lint-contracts` fails if it drifts from the pin.
RUN node scripts/patchSwaggerServer.mjs && \
    npx next build --webpack && \
    npx next-export-optimize-images


# Production serves the fully static export, so it needs neither the build
# toolchain (python3/make/g++) nor node_modules — only `serve` and `out/`.
# Starting from a clean base instead of inheriting `base` keeps the shipped
# image within the docker-perf budget. `curl` is kept because the
# docker-compose prod healthcheck (`curl -f http://…`) depends on it.
FROM public.ecr.aws/docker/library/node:26.5.0-alpine3.23 AS production

RUN apk add --no-cache curl=8.20.0-r0 && \
    npm install -g serve@14.2.0

WORKDIR /app

COPY --from=build /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-p", "3001"]