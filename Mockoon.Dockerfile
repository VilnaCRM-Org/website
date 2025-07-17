FROM node:23.11.1-alpine3.21


RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    apk add --no-cache curl=8.12.1-r1 && \
    npm install -g @mockoon/cli@9.2.0


WORKDIR /app


ADD https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml /app/data.yaml


USER appuser


HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD mockoon-cli list | grep -q running || exit 1


CMD ["mockoon-cli", "start", "--data", "/app/data.yaml", "--port", "8080"]
