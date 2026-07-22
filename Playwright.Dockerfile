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
# `pnpm install` fails under .npmrc's engine-strict. Install the exact version
# from .nvmrc over it so this image resolves the same Node as the Dockerfiles
# and CI, rather than being exempted from the check.
#
# /usr/local/bin precedes /usr/bin on PATH, so this shadows the vendored binary.
#
# The tarball is checked against a SHA-256 pinned here rather than against the
# SHASUMS256.txt served alongside it: that file is only authenticated by its
# detached signature, which this build does not verify, so trusting it would add
# no integrity over the TLS transport. Pinning matches how the Makefile pins
# RCA_SHA256_LINUX. Bumping .nvmrc means bumping these two digests — the
# mismatch fails the build closed, which is the intended behaviour.
ARG NODE_SHA256_X64=783130984963db7ba9cbd01089eaf2c2efb055c7c1693c943174b967b3050cb8
ARG NODE_SHA256_ARM64=6b4484c2190274175df9aa8f28e2d758a819cb1c1fe6ab481e2f95b463ab8508
COPY .nvmrc ./
RUN NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)" && \
    case "$(dpkg --print-architecture)" in \
      amd64) NODE_ARCH=x64;   NODE_SHA256="$NODE_SHA256_X64" ;; \
      arm64) NODE_ARCH=arm64; NODE_SHA256="$NODE_SHA256_ARM64" ;; \
      *) echo "Unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.gz" \
      -o /tmp/node.tar.gz && \
    echo "${NODE_SHA256}  /tmp/node.tar.gz" | sha256sum -c - && \
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 \
        --exclude=CHANGELOG.md --exclude=LICENSE --exclude=README.md && \
    rm /tmp/node.tar.gz && \
    npm install -g pnpm@10.6.5

# .npmrc carries engine-strict=true. Without it here, this image's install would
# silently opt out of the very gate the Node pin above exists to satisfy.
COPY package.json pnpm-lock.yaml .npmrc checkNodeVersion.js ./

RUN pnpm install

CMD ["tail", "-f", "/dev/null"]
