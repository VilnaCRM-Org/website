FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436 AS base

WORKDIR /app

RUN apk add --no-cache curl=8.20.0-r0 && \
    npm install -g @mockoon/cli@9.2.0

# Serve the committed contract, not a fresh download. The mock e2e runs against
# must be the same generation of the API as the swagger page and the Apollo mock,
# and the build must not depend on raw.githubusercontent.com being reachable.
# contracts/user-service/openapi.json is the exact artifact `lint-contracts` gates
# on, so Mockoon and the drift check can never diverge. curl stays installed for
# the container healthcheck.
COPY contracts/user-service/openapi.json /app/data.json

CMD ["mockoon-cli", "start", "--data", "/app/data.json", "--port", "8080"]
