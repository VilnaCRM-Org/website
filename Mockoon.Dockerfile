FROM public.ecr.aws/docker/library/node:22.12.0-alpine3.21 AS base

WORKDIR /app

RUN apk add --no-cache curl=8.14.1-r2 && \
    npm install -g @mockoon/cli@9.2.0

# Pinned, not `main`. The mock e2e runs against must be the same generation of
# the API as the swagger page and the Apollo mock; tracking main meant the mock
# served 21 endpoints while the pinned spec described 8.
ARG USER_SERVICE_VERSION=v2.6.0
RUN curl -fSL -o /app/data.yaml "https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${USER_SERVICE_VERSION}/.github/openapi-spec/spec.yaml"

CMD ["mockoon-cli", "start", "--data", "/app/data.yaml", "--port", "8080"]
