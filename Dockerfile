FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base

RUN apk add --no-cache \
    python3=3.12.13-r0\
    make=4.4.1-r3 \
    g++=15.2.0-r2 \
    curl=8.20.0-r0 && \
    npm install -g pnpm@10.6.5 serve@14.2.0


WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js scripts/*.mjs ./

RUN pnpm install


FROM base AS build

COPY . .

# Reads the committed contract under contracts/ — no network. Refresh it with
# `make update-contracts`; `make lint-contracts` fails if it drifts from the pin.
RUN node scripts/patchSwaggerServer.mjs && \
    npx next build --webpack && \
    npx next-export-optimize-images


FROM base AS production

COPY --from=build /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-p", "3001"]