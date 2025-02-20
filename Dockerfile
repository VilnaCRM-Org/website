FROM node:23-alpine3.20

RUN apk add --no-cache python3 make g++  \
    && npm install -g pnpm

WORKDIR /app

COPY . .

RUN make install

EXPOSE 3001
