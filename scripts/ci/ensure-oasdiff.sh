#!/usr/bin/env sh
# Provision the pinned oasdiff CLI into ./bin (idempotent, SHA256-verified).
#
# oasdiff is a standalone Go binary, NOT an npm dependency: it is absent from the
# node:*-alpine dev image, so it cannot run through PM_EXEC / the dev container.
# This helper gives the nightly OpenAPI drift leg (and a local `make
# lint-openapi`) a single, reproducible provisioning path to a gitignored ./bin.
#
# Mirrors scripts/ci/ensure-rca.sh deliberately — same pin-and-verify contract,
# same install location, same idempotence check.
set -eu

OASDIFF_BIN="${OASDIFF_BIN:-./bin/oasdiff}"
OASDIFF_VERSION="${OASDIFF_VERSION:-1.27.0}"
OASDIFF_SHA256_LINUX="${OASDIFF_SHA256_LINUX:-335de79be8df706735f7ab3edc35186e853c8add93d489d67e4e7fd70a07d08a}"

# Already the right version? Nothing to do (idempotent; no network needed).
# -Fwq: fixed-string, whole-word match so e.g. 1.27.01 cannot satisfy 1.27.0.
if [ -x "$OASDIFF_BIN" ] && "$OASDIFF_BIN" --version 2>/dev/null | grep -Fwq "$OASDIFF_VERSION"; then
  exit 0
fi

# The pinned digest covers the linux/amd64 asset only. Every other platform would
# need a different digest, so refuse rather than silently install an unverified
# build — `make lint-openapi` is host-only and its CI home is a ubuntu runner.
arch="$(uname -m)"
os="$(uname -s)"
if [ "$os" != "Linux" ] || { [ "$arch" != "x86_64" ] && [ "$arch" != "amd64" ]; }; then
  printf 'ERROR: no verified oasdiff v%s asset pinned for %s/%s.\n' "$OASDIFF_VERSION" "$os" "$arch" >&2
  printf 'Install oasdiff manually and point OASDIFF_BIN at it, or run the nightly workflow.\n' >&2
  exit 1
fi

mkdir -p "$(dirname "$OASDIFF_BIN")"
asset="oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz"
url="https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/${asset}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/oasdiff-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fsSL \
  --retry 3 \
  --retry-all-errors \
  --connect-timeout 10 \
  --max-time 120 \
  "$url" -o "$tmp/$asset"
printf '%s  %s\n' "$OASDIFF_SHA256_LINUX" "$tmp/$asset" | sha256sum -c -
# The archive is flat: LICENSE + oasdiff at the root, no versioned directory.
tar -xzf "$tmp/$asset" -C "$tmp"
install -m 0755 "$tmp/oasdiff" "$OASDIFF_BIN"
"$OASDIFF_BIN" --version
