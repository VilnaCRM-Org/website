FROM public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS base

RUN apk add --no-cache \
    python3=3.12.11-r0 \
    make=4.4.1-r2 \
    g++=14.2.0-r4 \
    curl=8.14.1-r2 && \
    npm install -g pnpm@10.6.5 serve@14.2.0 && \
    pnpm add -D js-yaml@4.1.0


WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js scripts/*.mjs ./

RUN pnpm install


FROM base AS build

COPY . .

RUN node scripts/fetchSwaggerSchema.mjs && \
    if [ "$NODE_ENV" != "production" ]; then \
      node scripts/patchSwaggerServer.mjs; \
    fi

RUN npx next build && \
    npx next-export-optimize-images


FROM base AS production

COPY --from=build /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-p", "3001"]