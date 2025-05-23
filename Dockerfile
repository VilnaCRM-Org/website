FROM node:23.11.1-alpine3.21 AS base

RUN apk add --no-cache \
    python3=3.12.10-r1 \
    make=4.4.1-r2 \
    g++=14.2.0-r4 \
    curl=8.12.1-r1 && \
    npm install -g pnpm@10.6.5

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install


# ---------- Build Stage ----------
FROM base AS build

COPY . .

RUN npx next build && \
    npx next-export-optimize-images && \
    echo "=== Build Stage Output ===" && \
    ls -la /app/out && \
    echo "=== End Build Stage Output ==="


# ---------- Production Stage ----------
FROM base AS production

COPY --from=build /app/out ./out

RUN echo "=== Production Stage Output ===" && \
    pwd && \
    ls -la && \
    echo "=== Contents of out directory ===" && \
    ls -la out && \
    echo "=== End Production Stage Output ==="
