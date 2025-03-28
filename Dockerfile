FROM node:22-alpine3.20

RUN apk add --no-cache python3=3.12.9-r0 make=4.4.1-r2 g++=14.2.0-r4 \
    && npm install -g pnpm@10.6.5

WORKDIR /app

COPY . .

RUN make install

EXPOSE 3001
