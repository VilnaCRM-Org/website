FROM node:23.10.0-alpine3.21

RUN apk add --no-cache python3=3.12.10-r0 make=4.4.1-r2 g++=14.2.0-r4 \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1