FROM node:23-alpine3.20

RUN npm install -g pnpm@10.4.1

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY docker/apollo-server apollo-server

RUN pnpm install
RUN pnpm exec tsc apollo-server/server.mts  apollo-server/type.ts  \
  --outDir out --rootDir ./ \
  --module NodeNext --moduleResolution NodeNext \
  --target ES6 --strict --resolveJsonModule \
  --experimentalDecorators --emitDecoratorMetadata \
  --esModuleInterop --allowSyntheticDefaultImports \
  --skipLibCheck --noImplicitAny --noEmitOnError

EXPOSE 4000

CMD ["node", "out/apollo-server/server.mjs"]
