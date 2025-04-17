FROM node:23.10.0-alpine3.21

RUN apk add --no-cache python3=3.12.10-r0 make=4.4.1-r2 g++=14.2.0-r4 curl \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install

EXPOSE 3001
