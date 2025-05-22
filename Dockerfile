FROM node:23.11.1-alpine3.21

RUN apk add --no-cache python3 make g++ curl \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install
