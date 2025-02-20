FROM node:23-alpine3.20

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY docker/apollo-server ./docker/apollo-server
COPY tsconfig.server.json ./

RUN pnpm install
RUN pnpm run compile-server

EXPOSE 4000

CMD ["node", "./out/docker/apollo-server/server.mjs"]
