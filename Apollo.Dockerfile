FROM node:23.10.0-alpine3.21

RUN npm install -g pnpm@10.6.5 @types/node@22.13.13 typescript@5.8.2

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY docker/apollo-server docker/apollo-server

RUN pnpm install --frozen-lockfile

RUN pnpm exec tsc \
    --target ES6 \
    --module NodeNext \
    --moduleResolution NodeNext \
    --strict \
    --esModuleInterop \
    --resolveJsonModule \
    --experimentalDecorators \
    --emitDecoratorMetadata \
    --outDir ./out \
    --rootDir ./ \
    --noEmit false \
    docker/apollo-server/server.mts \
    docker/apollo-server/type.ts

EXPOSE 4000

CMD ["node", "out/docker/apollo-server/server.mjs"]
