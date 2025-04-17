FROM node:23.10.0-alpine3.21

WORKDIR /app

RUN apk add --no-cache curl=8.12.1-r1 && \
    npm install -g @mockoon/cli@9.2.0

RUN curl -o /app/data.json "https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml"


CMD ["mockoon-cli", "start", "-d", "/app/data.json"]
