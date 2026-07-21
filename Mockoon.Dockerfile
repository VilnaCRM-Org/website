FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base

WORKDIR /app

RUN apk add --no-cache curl=8.20.0-r0 && \
    npm install -g @mockoon/cli@9.2.0

RUN curl -fSL -o /app/data.yaml "https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml"

CMD ["mockoon-cli", "start", "--data", "/app/data.yaml", "--port", "8080"]
