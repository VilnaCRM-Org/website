FROM node:20-alpine3.17

RUN apk add --no-cache python3 make g++ curl  \
    && npm install -g pnpm

WORKDIR /app

COPY . .

RUN make install
