FROM node:23-alpine3.20

RUN apk add --no-cache python3 make g++ curl \
    && npm install -g pnpm

WORKDIR /app

COPY . .

RUN make install

EXPOSE 3001
