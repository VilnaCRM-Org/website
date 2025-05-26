FROM node:23.11.1-alpine3.21

RUN apk add --no-cache python3=3.12.10-r0 make=4.4.1-r2 g++=14.2.0-r4 curl=8.12.1-r1 \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install
