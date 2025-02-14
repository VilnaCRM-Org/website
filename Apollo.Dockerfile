FROM node:20-alpine3.17

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./
COPY apollo-server ./apollo-server
COPY tsconfig.docker.json ./

RUN pnpm install

RUN pnpm run compile-apollo

EXPOSE 4000

CMD ["node", "./dist-docker/apollo-server/server.mjs"]
