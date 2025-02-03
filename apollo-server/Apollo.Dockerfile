FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm && \
    pnpm add @apollo/client @apollo/server graphql ts-node typescript --save-dev

COPY tsconfig.docker.json ./
COPY apollo-server.ts ./

CMD ["pnpm", "ts-node", "--project", "tsconfig.docker.json", "apollo-server.ts"]