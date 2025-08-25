FROM golang:1.24.1-alpine3.21 AS BUILDER

WORKDIR /app

ENV CGO_ENABLED=0

RUN go install go.k6.io/xk6/cmd/xk6@v0.11.0 && \
    xk6 build \
        --with github.com/szkiba/xk6-faker@v0.3.0 \
        --with github.com/mstoykov/xk6-counter@v0.0.1 \
        --with github.com/grafana/xk6-exec@v0.3.0 \
        --with github.com/avitalique/xk6-file@v1.4.0

FROM alpine:3.21

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=BUILDER /app/k6 /bin/

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD k6 version || exit 1

ENTRYPOINT ["k6"]
