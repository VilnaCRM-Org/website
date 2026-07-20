FROM public.ecr.aws/docker/library/node:22.12.0-alpine3.21 AS base

RUN apk add --no-cache \
    python3=3.12.13-r0\
    make=4.4.1-r2 \
    g++=14.2.0-r4 \
    curl=8.14.1-r2 && \
    npm install -g pnpm@10.6.5 serve@14.2.0


WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js scripts/*.mjs ./

RUN pnpm install


FROM base AS build

COPY . .

# Reads the committed contract under contracts/ — no network. Refresh it with
# `make update-contracts`; `make lint-contracts` fails if it drifts from the pin.
RUN node scripts/patchSwaggerServer.mjs

RUN npx next build --webpack && \
    npx next-export-optimize-images


FROM base AS production

COPY --from=build /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-p", "3001"]