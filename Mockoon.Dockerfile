FROM public.ecr.aws/docker/library/node:26.8.1-alpine3.23@sha256:871eb674ad6e692c91330a8959f1ce2f80ba3f445cdc54e306869d2ea265e42d AS base

WORKDIR /app

RUN apk add --no-cache curl=8.22.0-r0 && \
    npm install -g @mockoon/cli@9.2.0

# Serve the committed contract, not a fresh download. The mock e2e runs against
# must be the same generation of the API as the swagger page and the Apollo mock,
# and the build must not depend on raw.githubusercontent.com being reachable.
# contracts/user-service/openapi.json is the exact artifact `lint-contracts` gates
# on, so Mockoon and the drift check can never diverge. curl stays installed for
# the container healthcheck.
COPY contracts/user-service/openapi.json /app/data.json

CMD ["mockoon-cli", "start", "--data", "/app/data.json", "--port", "8080"]
