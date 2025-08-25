FROM node:23.11.1-alpine3.21


RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app


RUN apk add --no-cache curl=8.12.1-r1 && \
    npm install -g @mockoon/cli@9.2.0

ADD https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml /app/data.yaml

EXPOSE 8080


HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD nc -z localhost 8080 || exit 1

CMD ["mockoon-cli", "start", "--data", "/app/data.yaml", "--port", "8080"]
