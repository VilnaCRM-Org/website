FROM node:22-alpine3.20

WORKDIR /app

RUN apk add --no-cache curl=8.12.1-r0 && \
    npm install -g @mockoon/cli@9.2.0

RUN curl -o /app/data.json "https://raw.githubusercontent.com/VilnaCRM-Org/user-service/main/.github/openapi-spec/spec.yaml"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:8080 || exit 1

CMD ["mockoon-cli", "start", "-d", "/app/data.json"]
