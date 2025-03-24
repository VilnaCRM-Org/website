FROM node:23-alpine3.20

RUN npm install -g pnpm@10.6.5 @types/node typescript

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
