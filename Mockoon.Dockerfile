FROM public.ecr.aws/docker/library/node:26.8-alpine3.23@sha256:a3024faf41c40992531ecfb00604384665be870a44626afaf181c6d583f89296 AS base

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
