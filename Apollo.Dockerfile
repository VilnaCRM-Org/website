FROM node:22-alpine3.20

RUN apk add --no-cache curl=8.12.1-r0

RUN npm install -g pnpm@10.6.5 @types/node@22.13.13 typescript@5.8.2

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY docker/apollo-server/ docker/apollo-server/

RUN pnpm install --frozen-lockfile && pnpm exec tsc \
    --target ES6 \
    --module NodeNext \
    --moduleResolution NodeNext \
    --strict \
    --esModuleInterop \
    --resolveJsonModule \
    --experimentalDecorators \
    --emitDecoratorMetadata \
    --outDir ./out \
    --rootDir docker/apollo-server \
    docker/apollo-server/server.mts docker/apollo-server/type.ts

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "out/server.mjs"]
