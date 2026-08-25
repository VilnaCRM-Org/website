FROM public.ecr.aws/docker/library/golang:1.25.11-alpine3.22@sha256:65b4400aee0927412e9ed791a11893273a49d55df24841f7599660fb80dae464 AS builder

WORKDIR /app

ENV CGO_ENABLED 0

RUN go install go.k6.io/xk6/cmd/xk6@v0.11.0

RUN xk6 build \
    --with github.com/szkiba/xk6-faker@v0.3.0  \
    --with github.com/mstoykov/xk6-counter@v0.0.1  \
    --with github.com/grafana/xk6-exec@v0.3.0  \
    --with github.com/avitalique/xk6-file@v1.4.0
    
FROM public.ecr.aws/docker/library/alpine:3.21@sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d

COPY --from=builder /app/k6 /bin/

ENTRYPOINT [ "k6" ]