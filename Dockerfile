FROM node:23.10.0-alpine3.21

RUN apk add --no-cache python3 make g++ \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY . .

RUN make install

EXPOSE 3001
