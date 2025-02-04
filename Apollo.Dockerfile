FROM node:20-alpine3.17

RUN npm install -g pnpm

WORKDIR /app


COPY . .

EXPOSE 4000
RUN pnpm run compile-apollo

CMD ["node", "./dist-docker/apollo-server/server.mjs"]
