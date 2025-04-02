FROM node:22-alpine3.20

WORKDIR /app

RUN apk add --no-cache curl=8.12.1-r0

RUN npm install -g @mockoon/cli@9.2.0 typescript@5.8.2 && \
    npm install dotenv@16.4.7 @types/node@22.13.13 @types/dotenv@8.2.3 --save-dev && \
    npm install winston@3.11.0 @types/winston@2.4.4 --save-dev


COPY tsconfig.server.json tsconfig.server.json
COPY docker/mockoon docker/mockoon
COPY .env .env

RUN tsc --project tsconfig.server.json && node ./out/docker/mockoon/schemaFetcher.js

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:8080 || exit 1

CMD ["mockoon-cli", "start", "-d", "out/docker/mockoon/data.json"]
