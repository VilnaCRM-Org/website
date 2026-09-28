FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436 AS base

# bash lives here, not in a devcontainer lifecycle command, so it carries the same
# version pin as everything else: `devcontainer exec` hardcodes `bash -c`, but this
# Alpine base ships only busybox ash, and hadolint's DL3018 can't see an unpinned
# apk inside devcontainer.json.
RUN apk add --no-cache \
    bash=5.3.3-r1 \
    curl=8.22.0-r0 \
    g++=15.2.0-r2 \
    make=4.4.1-r3 \
    python3=3.12.14-r0 && \
    npm install -g bun@1.3.5 serve@14.2.0


WORKDIR /app

COPY package.json bun.lock checkNodeVersion.js scripts/*.mjs ./

RUN bun install --frozen-lockfile


FROM base AS build

COPY . .

# .dockerignore excludes .git, so this stage can't compute its own commit — `make
# build-out` passes it as a build-arg (default "unknown" so a bare `docker build`
# never fails for lack of one). Unused by the build itself; `out/version.json` is
# written on the host from the same value (docs/adr/0010-build-and-release-provenance.md).
ARG COMMIT_SHA=unknown
ENV COMMIT_SHA=$COMMIT_SHA

# Reads the committed contract under contracts/ — no network. Refresh it with
# `make update-contracts`; `make lint-contracts` fails if it drifts from the pin.
RUN node scripts/patchSwaggerServer.mjs && \
    npx next build --webpack && \
    npx next-export-optimize-images


# Static export needs neither the build toolchain nor node_modules, only `serve`
# and `out/` — a clean base instead of inheriting `base` keeps the image within
# the docker-perf budget. `curl` stays for the compose prod healthcheck.
FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436 AS production

RUN apk add --no-cache curl=8.22.0-r0 && \
    npm install -g serve@14.2.0

WORKDIR /app

COPY --from=build /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-p", "3001"]