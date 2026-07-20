FROM mcr.microsoft.com/playwright:v1.57.0-jammy

RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    python3=3.10.6-1~22.04.1 \
    make=4.3-4.1build1 \
    g++=4:11.2.0-1ubuntu1 \
    curl=7.81.0-* \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The base image vendors its own Node (24.11.1 in v1.57.0-jammy), which is both
# a different version from every other surface and below what the dependency
# graph requires — mute-stream, pulled in by Stryker, needs ^24.15.0, so
# `pnpm install` fails outright under .npmrc's engine-strict. Install the exact
# version from .nvmrc over it so this image resolves the same Node as the
# Dockerfiles and CI, rather than being exempted from the check.
#
# /usr/local/bin precedes /usr/bin on PATH, so this shadows the vendored binary.
# The tarball is checksum-verified against nodejs.org's signed SHASUMS256.txt,
# matching how scripts/ci/ensure-rca.sh provisions its pinned binary.
COPY .nvmrc ./
RUN NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)" && \
    TARBALL="node-v${NODE_VERSION}-linux-x64.tar.gz" && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}" -o /tmp/node.tar.gz && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o /tmp/SHASUMS256.txt && \
    grep " ${TARBALL}$" /tmp/SHASUMS256.txt | sed "s#${TARBALL}#/tmp/node.tar.gz#" | sha256sum -c - && \
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 \
        --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md && \
    rm /tmp/node.tar.gz /tmp/SHASUMS256.txt && \
    npm install -g pnpm@10.6.5

COPY package.json pnpm-lock.yaml checkNodeVersion.js ./

RUN pnpm install

CMD ["tail", "-f", "/dev/null"]
